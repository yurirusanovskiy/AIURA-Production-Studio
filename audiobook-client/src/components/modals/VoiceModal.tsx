'use client';

import React, { useState, useEffect } from 'react';
import {
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  Box,
  IconButton,
  Typography,
  Divider,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Autocomplete,
  Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutlined';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutlined';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  characterService,
  Character,
  LanguageProfile,
  getAudioUrl,
  VoiceDefinition,
} from '@/lib/api';

interface VoiceModalProps {
  open: boolean;
  onClose: () => void;
  characterToEdit?: Character | null;
  duplicateMode?: boolean;
  onSuccess?: (character: Character) => void;
}

export default function VoiceModal({
  open,
  onClose,
  characterToEdit,
  duplicateMode,
  onSuccess,
}: VoiceModalProps) {
  const isEditMode = !!characterToEdit && !duplicateMode;

  const [name, setName] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [gender, setGender] = useState<Character['gender']>('male');
  const [ageCategory, setAgeCategory] =
    useState<Character['age_category']>('adult');
  const [promptStyle, setPromptStyle] = useState('');
  const [promptStyleInputValue, setPromptStyleInputValue] = useState('');
  const [pitchOverride, setPitchOverride] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null); // #18

  const [playingVoiceUrl, setPlayingVoiceUrl] = useState<string | null>(null);
  const [audioInstance, setAudioInstance] = useState<HTMLAudioElement | null>(
    null,
  );

  const { data: voices = [] } = useQuery({
    queryKey: ['voices'],
    queryFn: characterService.getVoices,
  });

  const filteredVoices = React.useMemo(() => {
    return voices.filter((v) => v.gender === gender);
  }, [voices, gender]);

  const selectedVoice = React.useMemo(() => {
    return voices.find((v) => v.id === voiceId);
  }, [voices, voiceId]);

  const promptStyleArray = React.useMemo(
    () =>
      promptStyle
        ? promptStyle
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    [promptStyle],
  );

  // Language Profile States
  const [newLangCode, setNewLangCode] = useState('');
  const [newLangIsNative, setNewLangIsNative] = useState(true);
  const [newLangAccent, setNewLangAccent] = useState('');

  const queryClient = useQueryClient();

  const handlePlayVoice = (voiceUrl?: string) => {
    if (!voiceUrl) return;

    if (audioInstance) {
      audioInstance.pause();
    }

    if (playingVoiceUrl === voiceUrl) {
      setPlayingVoiceUrl(null);
      setAudioInstance(null);
      return;
    }

    const baseUrl = getAudioUrl(voiceUrl);
    const separator = baseUrl.includes('?') ? '&' : '?';
    const audio = new Audio(`${baseUrl}${separator}t=${Date.now()}`);
    audio.play();
    setPlayingVoiceUrl(voiceUrl);
    setAudioInstance(audio);

    audio.onended = () => {
      setPlayingVoiceUrl(null);
      setAudioInstance(null);
    };
    audio.onerror = () => {
      setPlayingVoiceUrl(null);
      setAudioInstance(null);
    };
  };

  useEffect(() => {
    if (open) {
      if (characterToEdit) {
        setName(characterToEdit.name || '');
        setVoiceId(characterToEdit.voice_id || '');
        setGender(characterToEdit.gender || 'male');
        setAgeCategory(characterToEdit.age_category || 'adult');
        setPromptStyle(characterToEdit.prompt_style || '');
        setPitchOverride(characterToEdit.pitch_override || '');
      } else {
        setName('');
        setVoiceId('');
        setGender('male');
        setAgeCategory('adult');
        setPromptStyle('');
        setPitchOverride('');
      }
      setPromptStyleInputValue('');
      setNewLangCode('');
      setNewLangIsNative(true);
      setSaveError(null); // clear error on (re)open
      setNewLangAccent('');
    } else {
      if (audioInstance) {
        audioInstance.pause();
      }
      setPlayingVoiceUrl(null);
      setAudioInstance(null);
    }
  }, [open, characterToEdit]);

  useEffect(() => {
    return () => {
      if (audioInstance) {
        audioInstance.pause();
      }
    };
  }, [audioInstance]);

  useEffect(() => {
    if (!voiceId || voices.length === 0) return;
    const selectedVoiceDef = voices.find((v) => v.id === voiceId);
    if (selectedVoiceDef && selectedVoiceDef.gender !== gender) {
      setGender(selectedVoiceDef.gender as Character['gender']);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name || !voiceId) throw new Error('Name and Voice ID are required');
      if (
        duplicateMode &&
        characterToEdit &&
        name.trim() === characterToEdit.name?.trim()
      ) {
        throw new Error(
          'You must choose a different name for the new character',
        );
      }

      let finalPromptStyle = promptStyle;
      const trimmedInput = promptStyleInputValue.trim();
      if (trimmedInput) {
        const typedTraits = trimmedInput
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
        const currentTraits = promptStyle
          ? promptStyle
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [];
        const mergedTraits = [...currentTraits];
        for (const trait of typedTraits) {
          if (!mergedTraits.includes(trait)) {
            mergedTraits.push(trait);
          }
        }
        finalPromptStyle = mergedTraits.join(', ');
      }

      const charData: Partial<Character> = {
        name,
        voice_id: voiceId,
        gender,
        age_category: ageCategory,
        prompt_style: finalPromptStyle,
        pitch_override: pitchOverride,
      };

      if (isEditMode) {
        return await characterService.updateCharacter(
          characterToEdit.id,
          charData,
        );
      } else {
        const newChar: Partial<Character> = {
          ...charData,
        };
        return await characterService.createCharacter(newChar as Character);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['characters'] });
      queryClient.invalidateQueries({ queryKey: ['projectCharacters'] });
      if (onSuccess) {
        onSuccess(data);
      }
      onClose();
    },
    onError: (error: Error) => {
      console.error('Failed to save voice', error);
      setSaveError(error.message || 'Failed to save voice. Please try again.'); // #18: inline instead of alert
    },
  });

  const addProfileMutation = useMutation({
    mutationFn: async () => {
      if (!characterToEdit) return;
      return await characterService.createLanguageProfile(characterToEdit.id, {
        language_code: newLangCode,
        is_native: newLangIsNative,
        accent_description: newLangAccent,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters'] });
      queryClient.invalidateQueries({ queryKey: ['projectCharacters'] });
      setNewLangCode('');
      setNewLangAccent('');
    },
  });

  const deleteProfileMutation = useMutation({
    mutationFn: async (profileId: number) => {
      if (!characterToEdit) return;
      return await characterService.deleteLanguageProfile(
        characterToEdit.id,
        profileId,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters'] });
      queryClient.invalidateQueries({ queryKey: ['projectCharacters'] });
    },
  });

  const textFieldStyles = {
    '& .MuiOutlinedInput-root': {
      bgcolor: 'rgba(255,255,255,0.03)',
      borderRadius: 2,
      color: '#FFFFFF',
      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
      '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
      '&.Mui-focused fieldset': { borderColor: '#82B1FF' },
    },
    '& .MuiInputLabel-root': { color: '#94A3B8' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#82B1FF' },
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: '#151A25',
            backgroundImage: 'none',
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.05)',
          },
        },
      }}
    >
      <DialogTitle sx={{ pb: 1, pt: 3, px: 3 }}>
        <Typography
          variant="h5"
          component="div"
          sx={{
            fontWeight: 600,
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          {duplicateMode ? (
            <>Duplicate Character: {characterToEdit?.name}</>
          ) : isEditMode ? (
            <>Edit Voice Profile</>
          ) : (
            <>Create New Voice</>
          )}
        </Typography>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ color: '#94A3B8', position: 'absolute', right: 8, top: 16 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pb: 4 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
          {/* Base Info */}
          <Typography
            variant="subtitle1"
            sx={{
              color: '#E2E8F0',
              fontWeight: 600,
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              pb: 1,
            }}
          >
            Core Settings
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Character Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              sx={{ ...textFieldStyles, flex: 1 }}
            />
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}
            >
              <TextField
                select
                label="Voice Selection"
                fullWidth
                value={voiceId}
                onChange={(e) => {
                  setVoiceId(e.target.value);
                  if (audioInstance) {
                    audioInstance.pause();
                    setPlayingVoiceUrl(null);
                    setAudioInstance(null);
                  }
                }}
                required
                sx={textFieldStyles}
              >
                {filteredVoices.map((voice) => (
                  <MenuItem key={voice.id} value={voice.id}>
                    {voice.id}
                  </MenuItem>
                ))}
              </TextField>
              {selectedVoice && selectedVoice.sample_audio_url && (
                <IconButton
                  onClick={() =>
                    handlePlayVoice(selectedVoice.sample_audio_url)
                  }
                  sx={{
                    color: '#82B1FF',
                    bgcolor: 'rgba(130, 177, 255, 0.1)',
                    '&:hover': { bgcolor: 'rgba(130, 177, 255, 0.2)' },
                    alignSelf: 'center',
                    height: 56,
                    width: 56,
                    borderRadius: 2,
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {playingVoiceUrl === selectedVoice.sample_audio_url ? (
                    <PauseCircleOutlineIcon fontSize="medium" />
                  ) : (
                    <PlayCircleOutlineIcon fontSize="medium" />
                  )}
                </IconButton>
              )}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              select
              label="Gender"
              fullWidth
              value={gender}
              onChange={(e) => {
                const newGender = e.target.value as Character['gender'];
                setGender(newGender);
                const firstVoice = voices.find((v) => v.gender === newGender);
                setVoiceId(firstVoice ? firstVoice.id : '');
                if (audioInstance) {
                  audioInstance.pause();
                  setPlayingVoiceUrl(null);
                  setAudioInstance(null);
                }
              }}
              sx={textFieldStyles}
            >
              <MenuItem value="male">Male</MenuItem>
              <MenuItem value="female">Female</MenuItem>
            </TextField>
            <TextField
              select
              label="Age Category"
              fullWidth
              value={ageCategory}
              onChange={(e) =>
                setAgeCategory(e.target.value as Character['age_category'])
              }
              sx={textFieldStyles}
            >
              <MenuItem value="child">Child</MenuItem>
              <MenuItem value="young">Young</MenuItem>
              <MenuItem value="adult">Adult</MenuItem>
              <MenuItem value="elderly">Elderly</MenuItem>
            </TextField>
          </Box>

          {/* Voice Prompt Engineering */}
          <Typography
            variant="subtitle1"
            sx={{
              color: '#E2E8F0',
              fontWeight: 600,
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              pb: 1,
              mt: 1,
            }}
          >
            Voice Instructions (Prompt Engineering)
          </Typography>

          <TextField
            select
            label="Pitch Override (Optional)"
            fullWidth
            value={pitchOverride}
            onChange={(e) => setPitchOverride(e.target.value)}
            sx={textFieldStyles}
            helperText="Overrides the base pitch of the generated voice"
            slotProps={{ formHelperText: { sx: { color: '#64748B' } } }}
          >
            <MenuItem value="">Default</MenuItem>
            <MenuItem value="Very High">Very High</MenuItem>
            <MenuItem value="High">High</MenuItem>
            <MenuItem value="Low">Low</MenuItem>
            <MenuItem value="Deep">Deep</MenuItem>
            <MenuItem value="Squeaky">Squeaky</MenuItem>
            <MenuItem value="Raspy">Raspy</MenuItem>
          </TextField>

          <Autocomplete
            multiple
            freeSolo
            options={[
              'Fast reading',
              'Slow reading',
              'Normal speed reading',
              'Measured pace',
              'Rapid pace',
              'Slow pace',
              'Dramatic pauses',
              'Enthusiastic',
              'Cheerful',
              'Gloomy',
              'Melancholic',
              'Energetic',
              'Warm',
              'Cold',
              'Sarcastic',
              'Raspy',
              'Hoarse',
              'Clear',
              'Breathy',
              'Nasal',
              'Muffled',
              'Gravelly',
              'Smooth',
              'Husky',
              "Smoker's voice",
              'Whispery',
              'Loud',
              'Soft-spoken',
              'Monotone',
              'Expressive',
            ]}
            value={promptStyleArray}
            inputValue={promptStyleInputValue}
            onInputChange={(e, newInputValue) => {
              setPromptStyleInputValue(newInputValue);
            }}
            onChange={(e, newValue) => {
              if (Array.isArray(newValue)) {
                setPromptStyle(newValue.join(', '));
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Base Voice Traits"
                placeholder="Type or select traits..."
                sx={textFieldStyles}
                helperText="Traits to apply to the character globally."
              />
            )}
          />

          {/* Language Profiles (Only visible when editing an existing character) */}
          {isEditMode && (
            <>
              <Typography
                variant="subtitle1"
                sx={{
                  color: '#E2E8F0',
                  fontWeight: 600,
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  pb: 1,
                  mt: 2,
                }}
              >
                Language Profiles & Accents
              </Typography>

              {characterToEdit?.language_profiles &&
              characterToEdit.language_profiles.length > 0 ? (
                <List
                  sx={{ bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2 }}
                >
                  {characterToEdit.language_profiles.map((profile) => (
                    <ListItem
                      key={profile.id}
                      divider
                      sx={{ borderColor: 'rgba(255,255,255,0.05)' }}
                    >
                      <ListItemText
                        primary={
                          <Typography sx={{ color: '#E2E8F0' }}>
                            Language: {profile.language_code}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="body2" sx={{ color: '#94A3B8' }}>
                            {profile.is_native
                              ? 'Native Speaker'
                              : `Accent: ${profile.accent_description}`}
                          </Typography>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() =>
                            profile.id &&
                            deleteProfileMutation.mutate(profile.id)
                          }
                          sx={{ color: '#EF4444' }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography
                  variant="body2"
                  sx={{ color: '#94A3B8', fontStyle: 'italic', mb: 2 }}
                >
                  You don&apos;t have any language profiles yet. Add one above.
                </Typography>
              )}

              <Paper
                sx={{
                  p: 2,
                  bgcolor: 'rgba(255,255,255,0.02)',
                  borderRadius: 2,
                  border: '1px solid rgba(255,255,255,0.05)',
                  mt: 1,
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{ color: '#E2E8F0', mb: 2 }}
                >
                  Add New Profile
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <TextField
                    label="Lang Code (e.g. ru-RU)"
                    size="small"
                    value={newLangCode}
                    onChange={(e) => setNewLangCode(e.target.value)}
                    sx={{ ...textFieldStyles, width: 150 }}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={newLangIsNative}
                        onChange={(e) => setNewLangIsNative(e.target.checked)}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: '#82B1FF',
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track':
                            { backgroundColor: '#82B1FF' },
                        }}
                      />
                    }
                    label={
                      <Typography sx={{ color: '#E2E8F0' }}>Native</Typography>
                    }
                  />
                  <TextField
                    label="Accent Description"
                    size="small"
                    fullWidth
                    disabled={newLangIsNative}
                    value={newLangAccent}
                    onChange={(e) => setNewLangAccent(e.target.value)}
                    sx={textFieldStyles}
                    placeholder="e.g. Heavy French accent"
                  />
                  <Button
                    variant="outlined"
                    onClick={() => addProfileMutation.mutate()}
                    disabled={
                      !newLangCode ||
                      (!newLangIsNative && !newLangAccent) ||
                      addProfileMutation.isPending
                    }
                    sx={{ color: '#82B1FF', borderColor: '#82B1FF' }}
                  >
                    Add
                  </Button>
                </Box>
              </Paper>
            </>
          )}
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          pb: 3,
          pt: 1,
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 1,
        }}
      >
        {/* #18: show save error inline instead of browser alert */}
        {saveError && (
          <Alert
            severity="error"
            onClose={() => setSaveError(null)}
            sx={{ mb: 1, borderRadius: 2 }}
          >
            {saveError}
          </Alert>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button
            onClick={onClose}
            disabled={saveMutation.isPending}
            sx={{
              color: '#94A3B8',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            variant="contained"
            disabled={!name || !voiceId || saveMutation.isPending}
            sx={{
              bgcolor: '#82B1FF',
              color: '#0B1121',
              px: 3,
              borderRadius: 2,
              fontWeight: 600,
              textTransform: 'none',
              '&:hover': { bgcolor: '#AECBFF' },
              '&.Mui-disabled': {
                bgcolor: 'rgba(130, 177, 255, 0.3)',
                color: 'rgba(11, 17, 33, 0.5)',
              },
            }}
          >
            {saveMutation.isPending ? (
              <CircularProgress size={24} sx={{ color: '#0B1121' }} />
            ) : duplicateMode ? (
              'Save as New Character'
            ) : (
              'Save Character'
            )}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
