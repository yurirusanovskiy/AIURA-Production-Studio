import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService, Scene, DiscoveredCharacter } from '@/lib/api';
import { notificationService } from '@/lib/notifications';

interface CastingModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  scenes: Scene[];
}

export default function CastingModal({
  open,
  onClose,
  projectId,
  scenes,
}: CastingModalProps) {
  const queryClient = useQueryClient();
  const [discoveredCharacters, setDiscoveredCharacters] = useState<
    DiscoveredCharacter[] | null
  >(null);

  // Send the full concatenated text of ALL scenes so that characters
  // appearing in the middle or end of the book are not missed.
  const fullBookText = scenes.map((s) => s.raw_text || '').join('\n\n');

  const discoverMutation = useMutation({
    mutationFn: () =>
      projectService.discoverCharacters(projectId, fullBookText),
    onSuccess: (data) => {
      setDiscoveredCharacters(data);
    },
    onError: (error: any) => {
      console.error('Failed to discover characters', error);
      const detail = error.response?.data?.detail;
      if (detail) {
        notificationService.error(detail);
      } else {
        notificationService.error('Failed to analyze book for characters.');
      }
    },
  });

  const handleClose = () => {
    setDiscoveredCharacters(null);
    discoverMutation.reset();
    onClose();
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      projectService.batchSaveCharacters(projectId, discoveredCharacters || []),
    onSuccess: async () => {
      // Use refetchQueries (not invalidateQueries) so the fresh data is
      // fetched and in cache BEFORE the modal closes — otherwise the
      // parent component re-renders with the stale list.
      await queryClient.refetchQueries({
        queryKey: ['projectCharacters', projectId],
      });
      await queryClient.refetchQueries({ queryKey: ['characters'] });
      handleClose();
    },
    onError: (error) => {
      console.error('Failed to save characters', error);
      notificationService.error('Failed to save the casting choices.');
    },
  });

  const handleAccept = () => {
    saveMutation.mutate();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: '#151A25',
            backgroundImage: 'none',
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.05)',
            minHeight: 400,
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 1,
          pt: 3,
          px: 3,
        }}
      >
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
          <AutoAwesomeIcon sx={{ color: '#82B1FF' }} />
          AI Casting Director
        </Typography>
        <IconButton onClick={handleClose} sx={{ color: '#94A3B8' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 2 }}>
        {!discoveredCharacters ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: 300,
              textAlign: 'center',
            }}
          >
            {discoverMutation.isPending ? (
              <>
                <CircularProgress size={48} sx={{ color: '#82B1FF', mb: 3 }} />
                <Typography variant="h6" sx={{ color: '#FFFFFF', mb: 1 }}>
                  Analyzing the manuscript...
                </Typography>
                <Typography variant="body2" sx={{ color: '#94A3B8' }}>
                  Finding characters and suggesting voices.
                </Typography>
              </>
            ) : (
              <>
                <AutoAwesomeIcon
                  sx={{ color: '#82B1FF', fontSize: 64, mb: 3, opacity: 0.5 }}
                />
                <Typography variant="h6" sx={{ color: '#FFFFFF', mb: 1 }}>
                  Ready to cast characters
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: '#94A3B8', mb: 3, maxWidth: 400 }}
                >
                  We will analyze the entire book to identify all characters —
                  including those appearing later in the story — and suggest the
                  perfect voice actors from our database.
                </Typography>
                {fullBookText.length > 50000 && (
                  <Typography
                    variant="caption"
                    sx={{ color: '#82B1FF', mb: 3, display: 'block' }}
                  >
                    📖 {Math.round(fullBookText.length / 1000)}K characters ·
                    estimated {Math.round(fullBookText.length / 30000) + 20}–
                    {Math.round(fullBookText.length / 15000) + 30}s
                  </Typography>
                )}
                <Button
                  variant="contained"
                  onClick={() => discoverMutation.mutate()}
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
                  Start Casting
                </Button>
              </>
            )}
          </Box>
        ) : (
          <List sx={{ width: '100%', bgcolor: 'transparent' }}>
            {discoveredCharacters.map((char, index) => (
              <ListItem
                key={index}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.02)',
                  mb: 1,
                  borderRadius: 2,
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <ListItemText
                  primary={
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        mb: 0.5,
                      }}
                    >
                      <Typography
                        sx={{
                          color: '#FFFFFF',
                          fontWeight: 600,
                          fontSize: '1.1rem',
                        }}
                      >
                        {char.discovered_name}
                      </Typography>
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
                    </Box>
                  }
                  secondary={
                    <Typography
                      component="span"
                      sx={{ color: '#94A3B8', display: 'block' }}
                    >
                      {char.traits}
                    </Typography>
                  }
                />
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: 1,
                  }}
                >
                  <Typography variant="caption" sx={{ color: '#82B1FF' }}>
                    {char.action === 'use_existing'
                      ? 'Linked to Global Cast'
                      : 'New Voice Required'}
                  </Typography>
                  <Chip
                    label={
                      char.suggested_voice_id ||
                      char.existing_character_id ||
                      'Unknown Voice'
                    }
                    color="primary"
                    sx={{ fontWeight: 600 }}
                  />
                </Box>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 1 }}>
        <Button onClick={handleClose} sx={{ color: '#94A3B8' }}>
          Cancel
        </Button>
        {discoveredCharacters && (
          <Button
            variant="contained"
            onClick={handleAccept}
            disabled={saveMutation.isPending}
            sx={{
              bgcolor: '#82B1FF',
              color: '#0B1121',
              px: 3,
              borderRadius: 2,
              fontWeight: 600,
              textTransform: 'none',
              '&:hover': { bgcolor: '#AECBFF' },
            }}
          >
            {saveMutation.isPending ? 'Saving...' : 'Approve & Save Cast'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
