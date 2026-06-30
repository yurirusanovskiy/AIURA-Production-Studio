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
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '@/lib/api';
import { notificationService } from '@/lib/notifications';

interface UploadBookModalProps {
  open: boolean;
  onClose: () => void;
}

export default function UploadBookModal({
  open,
  onClose,
}: UploadBookModalProps) {
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('ru-RU');
  const [file, setFile] = useState<File | null>(null);

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!title || !file) throw new Error('Title and File are required');

      const project = await projectService.createProject({
        title,
        language_code: language,
      });

      const projectId = project.id;
      if (!projectId) throw new Error('Failed to create project');

      const uploadRes = await projectService.uploadBook(projectId, file);
      return uploadRes;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      handleClose();
    },
    onError: (error) => {
      console.error('Failed to upload book', error);
      notificationService.error('Failed to upload book. Please try again.');
    },
  });

  const handleClose = () => {
    setTitle('');
    setLanguage('ru-RU');
    setFile(null);
    mutation.reset();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
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
          Create / Upload New Book
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

          <Button
            variant="outlined"
            component="label"
            startIcon={<CloudUploadIcon />}
            fullWidth
            sx={{
              height: 100,
              borderStyle: 'dashed',
              borderWidth: 2,
              borderColor: 'rgba(130, 177, 255, 0.3)',
              color: file ? '#FFFFFF' : '#82B1FF',
              bgcolor: file ? 'rgba(130, 177, 255, 0.1)' : 'transparent',
              '&:hover': {
                borderColor: '#82B1FF',
                bgcolor: 'rgba(130, 177, 255, 0.05)',
              },
            }}
            disabled={mutation.isPending}
          >
            {file
              ? file.name
              : 'Select Book File (.txt, .pdf, .epub, .docx, .fb2, .mobi)'}
            <input
              type="file"
              hidden
              accept=".txt,.pdf,.epub,.docx,.fb2,.mobi"
              onChange={handleFileChange}
            />
          </Button>

          {mutation.isPending && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={24} sx={{ color: '#82B1FF' }} />
              <Typography variant="body2" sx={{ color: '#94A3B8' }}>
                Uploading and segmenting book into scenes using ML...
              </Typography>
            </Box>
          )}
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
          disabled={!title || !file || mutation.isPending}
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
          Create Project
        </Button>
      </DialogActions>
    </Dialog>
  );
}
