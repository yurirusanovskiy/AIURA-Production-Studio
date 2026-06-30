'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from '@mui/material';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  settingsService,
  systemService,
  APIKey,
  APIKeyCreate,
} from '@/lib/api';
import { notificationService } from '@/lib/notifications';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [openModal, setOpenModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [storagePath, setStoragePath] = useState('');

  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: () => settingsService.getApiKeys(),
  });

  const { data: storageConfig, isLoading: isStorageLoading } = useQuery({
    queryKey: ['storageConfig'],
    queryFn: () => systemService.getStorageConfig(),
  });

  React.useEffect(() => {
    if (storageConfig) {
      setStoragePath(storageConfig.root_path);
    }
  }, [storageConfig]);

  const updateStorageMutation = useMutation({
    mutationFn: (path: string) =>
      systemService.updateStorageConfig({ root_path: path }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['storageConfig'] });
      notificationService.success(data.message);
    },
    onError: (err: any) => {
      notificationService.error(
        `Error updating storage path: ${err?.response?.data?.detail || err.message}`,
      );
    },
  });

  const addMutation = useMutation({
    mutationFn: (data: APIKeyCreate) => settingsService.addApiKey(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      setOpenModal(false);
      setNewKeyName('');
      setNewKeyValue('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => settingsService.deleteApiKey(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['apiKeys'] }),
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) => settingsService.activateApiKey(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['apiKeys'] }),
  });

  const handleAddKey = () => {
    if (!newKeyName.trim() || !newKeyValue.trim()) return;
    addMutation.mutate({ name: newKeyName, key_value: newKeyValue });
  };

  if (isLoading || isStorageLoading)
    return <Typography sx={{ p: 4 }}>Loading settings...</Typography>;

  return (
    <Box sx={{ p: 6, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 5,
        }}
      >
        <Box>
          <Typography
            variant="h3"
            sx={{ fontWeight: 800, mb: 1, letterSpacing: '-0.02em' }}
          >
            Settings
          </Typography>
          <Typography
            variant="body1"
            sx={{ color: 'text.secondary', maxWidth: 600 }}
          >
            Manage your Gemini API keys here. If one key runs out of its daily
            quota (Resource Exhausted), the system will automatically switch to
            another available key!
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={() => setOpenModal(true)}
          sx={{
            py: 1.5,
            px: 3,
            borderRadius: 2,
            textTransform: 'none',
            fontSize: '1rem',
          }}
        >
          Add API Key
        </Button>
      </Box>

      <Paper
        sx={{
          bgcolor: 'background.paper',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.02)' }}>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  Name
                </TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  Status
                </TableCell>
                <TableCell
                  sx={{ color: 'text.secondary', fontWeight: 600, width: 200 }}
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {apiKeys.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}
                  >
                    No API keys added yet. Add one to start generating audio!
                  </TableCell>
                </TableRow>
              ) : (
                apiKeys.map((key) => (
                  <TableRow
                    key={key.id}
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell>
                      <Typography sx={{ fontWeight: 500, fontSize: '1.05rem' }}>
                        {key.name}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary', mt: 0.5 }}
                      >
                        ******** (Hidden)
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {key.is_exhausted ? (
                        <Chip
                          label="Quota Exhausted"
                          color="error"
                          variant="outlined"
                          size="small"
                        />
                      ) : key.is_active ? (
                        <Chip
                          icon={<CheckCircleOutlinedIcon />}
                          label="Active"
                          color="success"
                          variant="outlined"
                          size="small"
                          sx={{ '& .MuiChip-icon': { color: '#4caf50' } }}
                        />
                      ) : (
                        <Chip
                          label="Available (Standby)"
                          color="default"
                          variant="outlined"
                          size="small"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {!key.is_active && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<PlayArrowOutlinedIcon />}
                            onClick={() => activateMutation.mutate(key.id)}
                          >
                            Set Active
                          </Button>
                        )}
                        <IconButton
                          color="error"
                          onClick={() => deleteMutation.mutate(key.id)}
                          size="small"
                          sx={{ border: '1px solid rgba(244,67,54,0.5)' }}
                        >
                          <DeleteOutlinedIcon />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Box sx={{ mt: 8, mb: 2 }}>
        <Typography
          variant="h4"
          sx={{ fontWeight: 800, mb: 1, letterSpacing: '-0.02em' }}
        >
          Storage Configuration
        </Typography>
        <Typography
          variant="body1"
          sx={{ color: 'text.secondary', maxWidth: 800, mb: 3 }}
        >
          Configure the absolute path on your local machine where all audio
          files, generated voice samples, and the database will be stored.
          Changing this path will automatically migrate existing files to the
          new location.
        </Typography>
        <Paper
          sx={{
            bgcolor: 'background.paper',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 4,
            p: 4,
          }}
        >
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <TextField
              fullWidth
              label="Absolute Storage Path"
              value={storagePath}
              onChange={(e) => setStoragePath(e.target.value)}
              placeholder="/Users/name/Documents/AudioBooks_Outputs"
              helperText="Note: Because this is a web app, you must paste the absolute path manually."
            />
            <Button
              variant="contained"
              onClick={() => updateStorageMutation.mutate(storagePath)}
              disabled={
                !storagePath.trim() ||
                storagePath === storageConfig?.root_path ||
                updateStorageMutation.isPending
              }
              sx={{
                py: 1.8,
                px: 4,
                borderRadius: 2,
                textTransform: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {updateStorageMutation.isPending
                ? 'Migrating...'
                : 'Save & Move Data'}
            </Button>
          </Box>
        </Paper>
      </Box>

      {/* Add Key Modal */}
      <Dialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle component="span">
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Add New API Key
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3, mt: 1 }}>
            We only store API keys locally on your computer in an SQLite
            database.
          </Alert>
          <TextField
            fullWidth
            label="Key Name (e.g., 'Wife's Key')"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            sx={{ mb: 3 }}
          />
          <TextField
            fullWidth
            label="Gemini API Key"
            type="password"
            value={newKeyValue}
            onChange={(e) => setNewKeyValue(e.target.value)}
            placeholder="AIzaSy..."
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setOpenModal(false)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleAddKey}
            variant="contained"
            disabled={
              !newKeyName.trim() || !newKeyValue.trim() || addMutation.isPending
            }
          >
            Add Key
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
