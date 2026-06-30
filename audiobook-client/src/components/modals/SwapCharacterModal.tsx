import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Typography,
  CircularProgress,
  Box,
  Radio,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { characterService, projectService, Character } from '@/lib/api';

interface SwapCharacterModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  characterToReplace: Character | null;
}

export default function SwapCharacterModal({
  open,
  onClose,
  projectId,
  characterToReplace,
}: SwapCharacterModalProps) {
  const queryClient = useQueryClient();
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    null,
  );

  const { data: characters, isLoading } = useQuery({
    queryKey: ['characters'],
    queryFn: () => characterService.getCharacters(),
    enabled: open,
  });

  const swapMutation = useMutation({
    mutationFn: (newCharId: string) => {
      if (!characterToReplace) throw new Error('No character to replace');
      return projectService.swapCharacter(
        projectId,
        characterToReplace.id,
        newCharId,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projectCharacters', projectId],
      });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      onClose();
      setSelectedCharacterId(null);
    },
  });

  const handleSwap = () => {
    if (selectedCharacterId) {
      swapMutation.mutate(selectedCharacterId);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { bgcolor: '#1E293B', color: '#F8FAFC' } } }}
    >
      <DialogTitle>Replace Character</DialogTitle>
      <DialogContent dividers sx={{ borderColor: '#334155' }}>
        <Typography variant="body2" sx={{ color: '#94A3B8', mb: 2 }}>
          Select an existing character to replace{' '}
          <strong>{characterToReplace?.name}</strong>. All lines assigned to{' '}
          {characterToReplace?.name} in this project will be updated to the new
          character.
        </Typography>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress sx={{ color: '#82B1FF' }} />
          </Box>
        ) : (
          <List sx={{ bgcolor: '#0B1121', borderRadius: 2 }}>
            {characters
              ?.filter((c) => c.id !== characterToReplace?.id)
              .map((char) => (
                <ListItem
                  key={char.id}
                  component="div"
                  onClick={() => setSelectedCharacterId(char.id)}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: '#1E293B' },
                    borderBottom: '1px solid #1E293B',
                  }}
                >
                  <Radio
                    checked={selectedCharacterId === char.id}
                    value={char.id}
                    name="character-radio"
                    sx={{
                      color: '#64748B',
                      '&.Mui-checked': { color: '#82B1FF' },
                    }}
                  />
                  <ListItemText
                    primary={char.name}
                    secondary={
                      <Typography variant="body2" sx={{ color: '#94A3B8' }}>
                        {`Voice: ${char.voice_id} | ${char.gender || 'Unknown'} | ${char.age_category || 'Unknown'}`}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: '1px solid #334155' }}>
        <Button onClick={onClose} sx={{ color: '#94A3B8' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSwap}
          disabled={!selectedCharacterId || swapMutation.isPending}
          sx={{
            bgcolor: '#82B1FF',
            color: '#0B1121',
            '&:hover': { bgcolor: '#AECBFF' },
          }}
        >
          {swapMutation.isPending ? 'Swapping...' : 'Replace Character'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
