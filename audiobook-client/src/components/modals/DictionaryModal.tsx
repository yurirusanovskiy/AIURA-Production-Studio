'use client';

import React, { useState } from 'react';
import {
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
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dictionaryService, DictionaryEntry } from '@/lib/api';
import { notificationService } from '@/lib/notifications';

interface DictionaryModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: DictionaryEntry | null;
}

export default function DictionaryModal({
  open,
  onClose,
  initialData,
}: DictionaryModalProps) {
  const [word, setWord] = useState(initialData?.word || '');
  const [phoneticReplacement, setPhoneticReplacement] = useState(
    initialData?.phonetic_replacement || '',
  );
  const [language, setLanguage] = useState(initialData?.language || 'ru-RU');
  const [entryType, setEntryType] = useState<DictionaryEntry['entry_type']>(
    initialData?.entry_type || 'word',
  );

  const isEditing = !!initialData;

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!word || !phoneticReplacement)
        throw new Error('Word and phonetic replacement are required');

      const entryData: DictionaryEntry = {
        word,
        phonetic_replacement: phoneticReplacement,
        language,
        entry_type: entryType,
      };

      if (isEditing && initialData.id) {
        return await dictionaryService.updateEntry(initialData.id, entryData);
      } else {
        return await dictionaryService.createEntry(entryData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dictionary'] });
      handleClose();
    },
    onError: (error) => {
      console.error('Failed to save dictionary entry', error);
      notificationService.error('Failed to save entry. Please try again.');
    },
  });

  const handleClose = () => {
    setWord('');
    setPhoneticReplacement('');
    setLanguage('ru-RU');
    setEntryType('word');
    mutation.reset();
    onClose();
  };

  const textFieldStyles = {
    '& .MuiOutlinedInput-root': {
      bgcolor: 'rgba(255,255,255,0.03)',
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
    '& .MuiInputLabel-root': {
      color: '#94A3B8',
    },
    '& .MuiInputLabel-root.Mui-focused': {
      color: '#82B1FF',
    },
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
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
          sx={{ fontWeight: 600, color: '#FFFFFF' }}
        >
          {initialData ? 'Edit Phonetic Rule' : 'Add Phonetic Rule'}
        </Typography>
        <IconButton onClick={handleClose} sx={{ color: '#94A3B8' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
          <TextField
            label="Word"
            fullWidth
            value={word}
            onChange={(e) => setWord(e.target.value)}
            disabled={mutation.isPending}
            required
            sx={textFieldStyles}
          />

          <TextField
            label="Phonetic Replacement (e.g. з+амок)"
            fullWidth
            value={phoneticReplacement}
            onChange={(e) => setPhoneticReplacement(e.target.value)}
            disabled={mutation.isPending}
            required
            sx={textFieldStyles}
          />

          <TextField
            select
            label="Language"
            fullWidth
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={mutation.isPending}
            sx={textFieldStyles}
          >
            <MenuItem value="ru-RU">🇷🇺 Russian</MenuItem>
            <MenuItem value="ro-RO">🇷🇴 Romanian</MenuItem>
            <MenuItem value="en-US">🇺🇸 English</MenuItem>
            <MenuItem value="he-IL">🇮🇱 Hebrew</MenuItem>
          </TextField>

          <TextField
            select
            label="Entry Type"
            fullWidth
            value={entryType}
            onChange={(e) =>
              setEntryType(e.target.value as DictionaryEntry['entry_type'])
            }
            disabled={mutation.isPending}
            sx={textFieldStyles}
          >
            <MenuItem value="word">Word</MenuItem>
            <MenuItem value="name">Name</MenuItem>
            <MenuItem value="place">Place</MenuItem>
          </TextField>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 1 }}>
        <Button
          onClick={handleClose}
          disabled={mutation.isPending}
          sx={{
            color: '#94A3B8',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={() => mutation.mutate()}
          variant="contained"
          disabled={!word || !phoneticReplacement || mutation.isPending}
          sx={{
            bgcolor: '#82B1FF',
            color: '#0B1121',
            px: 3,
            borderRadius: 2,
            fontWeight: 600,
            textTransform: 'none',
            '&:hover': {
              bgcolor: '#AECBFF',
            },
            '&.Mui-disabled': {
              bgcolor: 'rgba(130, 177, 255, 0.3)',
              color: 'rgba(11, 17, 33, 0.5)',
            },
          }}
        >
          {mutation.isPending ? (
            <CircularProgress size={24} sx={{ color: '#0B1121' }} />
          ) : isEditing ? (
            'Save Changes'
          ) : (
            'Add Entry'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
