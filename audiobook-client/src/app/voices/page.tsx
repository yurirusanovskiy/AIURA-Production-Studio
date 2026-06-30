'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Container,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import PersonIcon from '@mui/icons-material/Person';
import SyncIcon from '@mui/icons-material/Sync';
import { useQuery } from '@tanstack/react-query';
import {
  characterService,
  Character,
  getAudioUrl,
  VoiceDefinition,
} from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import VoiceModal from '@/components/modals/VoiceModal';
import ItemCard from '@/components/cards/ItemCard';
import ConfirmModal from '@/components/modals/ConfirmModal';

export default function VoicesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [characterToEdit, setCharacterToEdit] = useState<Character | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState('');

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [activeAudio, setActiveAudio] = useState<HTMLAudioElement | null>(null);

  const [charToDelete, setCharToDelete] = useState<{ id: string; name: string } | null>(null);

  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: characterService.deleteCharacter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters'] });
      setCharToDelete(null);
    },
  });

  const handleDelete = (id: string, name: string) => {
    setCharToDelete({ id, name });
  };

  const handleEdit = (char: Character) => {
    setCharacterToEdit(char);
    setModalOpen(true);
  };

  const {
    data: characters,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['characters'],
    queryFn: characterService.getCharacters,
  });

  const { data: voices = [] } = useQuery({
    queryKey: ['voices'],
    queryFn: characterService.getVoices,
  });

  const filteredCharacters =
    characters?.filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.voice_id.toLowerCase().includes(searchQuery.toLowerCase()),
    ) || [];

  const handlePlaySample = (
    charId: string,
    voiceId: string,
    charSampleUrl?: string,
  ) => {
    const voice = voices.find((v) => v.id === voiceId);
    const sampleUrl = voice?.sample_audio_url || charSampleUrl;
    if (!sampleUrl) return;

    if (activeAudio) {
      activeAudio.pause();
    }

    if (playingId === charId) {
      setPlayingId(null);
      setActiveAudio(null);
      return;
    }

    setPlayingId(charId);
    const baseUrl = getAudioUrl(sampleUrl);
    const separator = baseUrl.includes('?') ? '&' : '?';
    const audio = new Audio(`${baseUrl}${separator}t=${Date.now()}`);
    audio.play();
    setActiveAudio(audio);

    audio.onended = () => {
      setPlayingId(null);
      setActiveAudio(null);
    };
    audio.onerror = () => {
      setPlayingId(null);
      setActiveAudio(null);
    };
  };

  React.useEffect(() => {
    return () => {
      if (activeAudio) {
        activeAudio.pause();
      }
    };
  }, [activeAudio]);

  return (
    <Box
      sx={{
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        p: { xs: 2, md: 4 },
      }}
    >
      {/* Header Area */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 4,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontWeight: 600, color: '#FFFFFF', mb: 1 }}
          >
            Voice Profiles
          </Typography>
          <Typography variant="body1" sx={{ color: '#94A3B8' }}>
            Manage and audition AI voices for your cast
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setCharacterToEdit(null);
            setModalOpen(true);
          }}
          sx={{
            bgcolor: '#82B1FF',
            color: '#0B1121',
            px: 3,
            py: 1.5,
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            '&:hover': {
              bgcolor: '#AECBFF',
            },
          }}
        >
          New Character
        </Button>
      </Box>

      {/* Search Bar */}
      <TextField
        fullWidth
        placeholder="Search characters by name..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{
          mb: 4,
          '& .MuiOutlinedInput-root': {
            bgcolor: '#212836',
            borderRadius: 2,
            color: '#FFFFFF',
            '& fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.1)',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.2)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#82B1FF',
            },
          },
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#94A3B8' }} />
              </InputAdornment>
            ),
          },
        }}
      />

      <Container maxWidth="xl" sx={{ flexGrow: 1, px: '0 !important' }}>
        {isLoading ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '40vh',
            }}
          >
            <CircularProgress sx={{ color: '#82B1FF' }} />
          </Box>
        ) : error ? (
          <Typography color="error">
            Failed to load voices. Ensure backend is running.
          </Typography>
        ) : filteredCharacters.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '40vh',
            }}
          >
            <Typography variant="h6" sx={{ color: '#94A3B8' }}>
              No characters found.
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {filteredCharacters.map((char) => {
              const voiceDef = voices.find((v) => v.id === char.voice_id);
              const sampleUrl =
                voiceDef?.sample_audio_url || char.sample_audio_url;
              const hasVoiceSample = !!sampleUrl;
              const isPlaying = playingId === char.id;

              return (
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={char.id}>
                  <ItemCard
                    title={char.name}
                    subtitle={char.voice_id}
                    iconNode={<PersonIcon sx={{ color: '#82B1FF' }} />}
                    chips={[
                      ...(char.gender ? [{ label: char.gender }] : []),
                      ...(char.age_category
                        ? [{ label: char.age_category }]
                        : []),
                    ]}
                    bottomContent={
                      char.prompt_style ? (
                        <Typography
                          variant="body2"
                          sx={{
                            color: '#94A3B8',
                            fontStyle: 'italic',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          &quot;{char.prompt_style}&quot;
                        </Typography>
                      ) : undefined
                    }
                    topRightActions={
                      <>
                        <IconButton
                          size="small"
                          onClick={() => handleEdit(char)}
                          sx={{
                            color: '#94A3B8',
                            '&:hover': { color: '#82B1FF' },
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(char.id, char.name)}
                          sx={{
                            color: '#94A3B8',
                            '&:hover': { color: '#EF4444' },
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          sx={{
                            color: isPlaying ? '#82B1FF' : '#94A3B8',
                            bgcolor: isPlaying
                              ? 'rgba(130, 177, 255, 0.1)'
                              : 'transparent',
                            ml: 1,
                          }}
                          disabled={!hasVoiceSample}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlaySample(
                              char.id,
                              char.voice_id,
                              char.sample_audio_url || undefined,
                            );
                          }}
                          title="Play Sample"
                          size="small"
                        >
                          {hasVoiceSample ? (
                            <VolumeUpIcon fontSize="small" />
                          ) : (
                            <VolumeOffIcon fontSize="small" />
                          )}
                        </IconButton>
                      </>
                    }
                  />
                </Grid>
              );
            })}
          </Grid>
        )}
      </Container>

      <VoiceModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setCharacterToEdit(null);
        }}
        characterToEdit={characterToEdit}
      />

      <ConfirmModal
        open={!!charToDelete}
        onClose={() => setCharToDelete(null)}
        onConfirm={() => {
          if (charToDelete) {
            deleteMutation.mutate(charToDelete.id);
          }
        }}
        title="Delete Character"
        message={`Are you sure you want to delete the character "${charToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        isPending={deleteMutation.isPending}
      />
    </Box>
  );
}
