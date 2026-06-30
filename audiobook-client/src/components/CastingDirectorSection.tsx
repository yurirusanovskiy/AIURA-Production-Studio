'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Chip,
  IconButton,
  List,
  ListItem,
  Tooltip,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesomeOutlined';
import VolumeUpIcon from '@mui/icons-material/VolumeUpOutlined';
import VolumeOffIcon from '@mui/icons-material/VolumeOffOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  api,
  projectService,
  characterService,
  Character,
  Scene,
  getAudioUrl,
  VoiceDefinition,
} from '@/lib/api';
import CastingModal from '@/components/modals/CastingModal';
import VoiceModal from '@/components/modals/VoiceModal';
import SwapCharacterModal from '@/components/modals/SwapCharacterModal';
import AliasModal from '@/components/modals/AliasModal';
import { notificationService } from '@/lib/notifications';

interface CastingDirectorSectionProps {
  projectId: string;
  scenes: Scene[];
}

export default function CastingDirectorSection({
  projectId,
  scenes,
}: CastingDirectorSectionProps) {
  const queryClient = useQueryClient();
  const [castingOpen, setCastingOpen] = useState(false);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [characterToDuplicate, setCharacterToDuplicate] =
    useState<Character | null>(null);
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [characterToSwap, setCharacterToSwap] = useState<Character | null>(
    null,
  );
  const [aliasModalOpen, setAliasModalOpen] = useState(false);
  const [characterToAlias, setCharacterToAlias] = useState<Character | null>(
    null,
  );

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [activeAudio, setActiveAudio] = useState<HTMLAudioElement | null>(null);

  const { data: voices = [] } = useQuery<VoiceDefinition[]>({
    queryKey: ['voices'],
    queryFn: characterService.getVoices,
  });

  const { data: characters, isLoading } = useQuery({
    queryKey: ['projectCharacters', projectId],
    queryFn: () => projectService.getProjectCharacters(projectId),
    enabled: !!projectId,
  });

  const linkMutation = useMutation({
    mutationFn: (characterId: string) =>
      projectService.linkCharacter(projectId, characterId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projectCharacters', projectId],
      });
    },
    onError: (error) => {
      console.error('Failed to link character to project', error);
      notificationService.error('Failed to add new character to project.');
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: (characterId: string) =>
      projectService.unlinkCharacter(projectId, characterId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projectCharacters', projectId],
      });
    },
    onError: (error) => {
      console.error('Failed to unlink character', error);
      notificationService.error('Failed to remove character from project.');
    },
  });

  const aliasMutation = useMutation({
    mutationFn: ({
      characterId,
      alias,
    }: {
      characterId: string;
      alias: string;
    }) => projectService.updateCharacterAlias(projectId, characterId, alias),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projectCharacters', projectId],
      });
    },
    onError: (error) => {
      console.error('Failed to update alias', error);
      notificationService.error('Failed to update alias.');
    },
  });

  const handleEdit = (char: Character) => {
    setCharacterToDuplicate(char);
    setDuplicateModalOpen(true);
  };

  const handleSwap = (char: Character) => {
    setCharacterToSwap(char);
    setSwapModalOpen(true);
  };

  const handleAliasOpen = (char: Character) => {
    setCharacterToAlias(char);
    setAliasModalOpen(true);
  };

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
    /* eslint-disable react-hooks/purity, react-hooks/immutability */
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
    /* eslint-enable react-hooks/purity, react-hooks/immutability */
  };

  React.useEffect(() => {
    return () => {
      if (activeAudio) {
        activeAudio.pause();
      }
    };
  }, [activeAudio]);

  if (isLoading) {
    return <CircularProgress sx={{ color: '#82B1FF', my: 4 }} />;
  }

  const hasCharacters = characters && characters.length > 0;

  return (
    <Box sx={{ mb: 6 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <AutoAwesomeIcon sx={{ color: '#82B1FF', mr: 2 }} />
        <Typography variant="h5" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
          Project Cast
        </Typography>
      </Box>

      {!hasCharacters ? (
        <Card
          sx={{
            bgcolor: 'rgba(130, 177, 255, 0.05)',
            border: '1px dashed rgba(130, 177, 255, 0.3)',
            borderRadius: 3,
            textAlign: 'center',
            py: 6,
          }}
        >
          <AutoAwesomeIcon
            sx={{ color: '#82B1FF', fontSize: 48, mb: 2, opacity: 0.5 }}
          />
          <Typography variant="h6" sx={{ color: '#FFFFFF', mb: 1 }}>
            No cast assigned yet
          </Typography>
          <Typography variant="body2" sx={{ color: '#94A3B8', mb: 3 }}>
            Run the AI Casting Director to automatically discover characters
            from your chapters.
          </Typography>
          <Button
            variant="contained"
            onClick={() => setCastingOpen(true)}
            sx={{
              bgcolor: '#82B1FF',
              color: '#0B1121',
              px: 4,
              py: 1.5,
              borderRadius: 2,
              fontWeight: 600,
              textTransform: 'none',
              '&:hover': { bgcolor: '#AECBFF' },
            }}
          >
            Run AI Casting
          </Button>
        </Card>
      ) : (
        <Card
          sx={{
            bgcolor: '#212836',
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <CardContent sx={{ p: 0 }}>
            <List sx={{ width: '100%', p: 0 }}>
              {characters.map((char, index) => (
                <ListItem
                  key={char.id}
                  divider={index < characters.length - 1}
                  sx={{
                    px: 3,
                    py: 2,
                    borderColor: 'rgba(255,255,255,0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 0.5,
                        flexWrap: 'wrap',
                      }}
                    >
                      {/* Primary display: alias (role name in this project) */}
                      <Typography
                        sx={{
                          color: '#FFFFFF',
                          fontWeight: 700,
                          fontSize: '1.05rem',
                        }}
                      >
                        {char.alias || char.name}
                      </Typography>
                      {/* If alias differs from global name, show "voiced by" indicator */}
                      {char.alias && char.alias !== char.name && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: '#82B1FF',
                            fontStyle: 'italic',
                            fontSize: '0.8rem',
                          }}
                        >
                          voiced by {char.name}
                        </Typography>
                      )}
                      <Chip
                        label={char.gender}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.05)',
                          color: '#94A3B8',
                        }}
                      />
                      <Chip
                        label={char.age_category}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.05)',
                          color: '#94A3B8',
                        }}
                      />
                      <Chip
                        label={`Voice: ${char.voice_id}`}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(130, 177, 255, 0.1)',
                          color: '#82B1FF',
                          fontWeight: 500,
                        }}
                      />
                    </Box>
                    <Typography variant="body2" sx={{ color: '#94A3B8' }}>
                      {char.prompt_style}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, ml: 4 }}>
                    {(() => {
                      const voiceDef = voices.find(
                        (v) => v.id === char.voice_id,
                      );
                      const sampleUrl =
                        voiceDef?.sample_audio_url || char.sample_audio_url;
                      const hasSample = !!sampleUrl;
                      const isPlaying = playingId === char.id;

                      return (
                        <Tooltip
                          title={
                            hasSample
                              ? isPlaying
                                ? 'Pause Sample'
                                : 'Play Sample'
                              : 'No Sample Available'
                          }
                        >
                          <span>
                            <IconButton
                              onClick={() =>
                                handlePlaySample(
                                  char.id,
                                  char.voice_id,
                                  char.sample_audio_url,
                                )
                              }
                              disabled={!hasSample}
                              sx={{
                                color: isPlaying ? '#82B1FF' : '#94A3B8',
                                bgcolor: isPlaying
                                  ? 'rgba(130, 177, 255, 0.1)'
                                  : 'transparent',
                                '&:hover': {
                                  bgcolor: isPlaying
                                    ? 'rgba(130, 177, 255, 0.2)'
                                    : 'rgba(255, 255, 255, 0.05)',
                                  color: '#82B1FF',
                                },
                              }}
                            >
                              {hasSample ? <VolumeUpIcon /> : <VolumeOffIcon />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      );
                    })()}

                    <Tooltip title="Edit Role Alias (project-specific name)">
                      <IconButton
                        onClick={() => handleAliasOpen(char)}
                        sx={{
                          color:
                            char.alias && char.alias !== char.name
                              ? '#82B1FF'
                              : '#94A3B8',
                          '&:hover': { color: '#82B1FF' },
                        }}
                      >
                        <LabelOutlinedIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Edit Character Voice">
                      <IconButton
                        onClick={() => handleEdit(char)}
                        sx={{
                          color: '#94A3B8',
                          '&:hover': { color: '#FFFFFF' },
                        }}
                      >
                        <EditOutlinedIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Replace Character">
                      <IconButton
                        onClick={() => handleSwap(char)}
                        sx={{
                          color: '#94A3B8',
                          '&:hover': { color: '#82B1FF' },
                        }}
                      >
                        <SwapHorizOutlinedIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ListItem>
              ))}
            </List>

            <Box
              sx={{
                p: 2,
                bgcolor: 'rgba(0,0,0,0.2)',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <Button
                startIcon={<AutoAwesomeIcon />}
                onClick={() => setCastingOpen(true)}
                sx={{ color: '#82B1FF', textTransform: 'none' }}
              >
                Rerun Casting
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      <CastingModal
        open={castingOpen}
        onClose={() => setCastingOpen(false)}
        projectId={projectId}
        scenes={scenes}
      />

      {duplicateModalOpen && characterToDuplicate && (
        <VoiceModal
          open={duplicateModalOpen}
          onClose={() => {
            setDuplicateModalOpen(false);
            setCharacterToDuplicate(null);
          }}
          characterToEdit={characterToDuplicate}
          duplicateMode={true}
          onSuccess={(newChar) => {
            linkMutation.mutate(newChar.id!);
          }}
        />
      )}

      {swapModalOpen && characterToSwap && (
        <SwapCharacterModal
          open={swapModalOpen}
          onClose={() => {
            setSwapModalOpen(false);
            setCharacterToSwap(null);
          }}
          projectId={projectId}
          characterToReplace={characterToSwap}
        />
      )}

      <AliasModal
        open={aliasModalOpen}
        onClose={() => {
          setAliasModalOpen(false);
          setCharacterToAlias(null);
        }}
        character={characterToAlias}
        onSave={(alias) => {
          if (characterToAlias) {
            aliasMutation.mutate({ characterId: characterToAlias.id!, alias });
          }
        }}
      />
    </Box>
  );
}
