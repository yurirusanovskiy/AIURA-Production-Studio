import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
} from '@mui/material';
import { Character } from '@/lib/api';

interface AliasModalProps {
  open: boolean;
  onClose: () => void;
  character: Character | null;
  onSave: (alias: string) => void;
}

export default function AliasModal({
  open,
  onClose,
  character,
  onSave,
}: AliasModalProps) {
  const [alias, setAlias] = useState('');

  useEffect(() => {
    if (open && character) {
      setAlias(character.alias || character.name);
    }
  }, [open, character]);

  const handleSave = () => {
    onSave(alias);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: '#1E293B',
            color: '#FFFFFF',
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
          },
        },
      }}
    >
      <DialogTitle
        sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)', pb: 2 }}
      >
        Edit Role Alias
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        <Typography variant="body2" sx={{ color: '#94A3B8', mb: 2 }}>
          Set a project-specific name for how this character is referred to in
          the script. The global character name will remain "{character?.name}".
        </Typography>
        <TextField
          fullWidth
          label="Role Alias"
          variant="outlined"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          sx={{
            input: { color: '#FFFFFF' },
            label: { color: '#94A3B8' },
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              '&:hover fieldset': { borderColor: '#82B1FF' },
              '&.Mui-focused fieldset': { borderColor: '#82B1FF' },
            },
          }}
        />
      </DialogContent>
      <DialogActions
        sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <Button onClick={onClose} sx={{ color: '#94A3B8' }}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          sx={{
            bgcolor: '#82B1FF',
            color: '#0B1121',
            '&:hover': { bgcolor: '#AECBFF' },
          }}
        >
          Save Alias
        </Button>
      </DialogActions>
    </Dialog>
  );
}
