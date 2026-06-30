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
  Typography,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '@/lib/api';
import { notificationService } from '@/lib/notifications';

interface ManualProjectModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ManualProjectModal({
  open,
  onClose,
}: ManualProjectModalProps) {
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('ru-RU');
  const [description, setDescription] = useState('');

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!title) throw new Error('Title is required');

      const project = await projectService.createProject({
        title,
        description,
        // Backend could support language later
      });
      return project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      handleClose();
    },
    onError: (error) => {
      console.error('Failed to create project', error);
      notificationService.error('Failed to create project. Please try again.');
    },
  });

  const handleClose = () => {
    setTitle('');
    setLanguage('ru-RU');
    setDescription('');
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
          Create New Project
        </Typography>
        <IconButton onClick={handleClose} sx={{ color: '#94A3B8' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
          <TextField
            label="Project Title"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={mutation.isPending}
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
            label="Description (Optional)"
            multiline
            rows={3}
            fullWidth
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={mutation.isPending}
            sx={textFieldStyles}
          />
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
          disabled={!title || mutation.isPending}
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
          ) : (
            'Create Project'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
