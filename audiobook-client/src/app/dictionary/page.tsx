'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Container,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dictionaryService, DictionaryEntry } from '@/lib/api';
import DictionaryModal from '@/components/modals/DictionaryModal';
import ConfirmModal from '@/components/modals/ConfirmModal';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

export default function DictionaryPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DictionaryEntry | null>(
    null,
  );
  const [entryToDelete, setEntryToDelete] = useState<{ id: number; word: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  const {
    data: entries,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['dictionary'],
    queryFn: () => dictionaryService.getEntries(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => dictionaryService.deleteEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dictionary'] });
      setEntryToDelete(null);
    },
  });

  const filteredEntries = entries?.filter(
    (entry) =>
      entry.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.phonetic_replacement
        .toLowerCase()
        .includes(searchQuery.toLowerCase()),
  );

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
            Phonetic Dictionary
          </Typography>
          <Typography variant="body1" sx={{ color: '#94A3B8' }}>
            Custom pronunciation overrides for TTS engines
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditingEntry(null);
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
          Add Entry
        </Button>
      </Box>

      {/* Search Bar */}
      <TextField
        fullWidth
        placeholder="Search words or phonetics..."
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
            Failed to load dictionary. Ensure backend is running.
          </Typography>
        ) : filteredEntries?.length === 0 ? (
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
              No phonetic rules found. Add one to correct AI pronunciation.
            </Typography>
          </Box>
        ) : (
          <TableContainer
            component={Paper}
            sx={{
              bgcolor: '#212836',
              borderRadius: 3,
              border: '1px solid rgba(255, 255, 255, 0.05)',
              backgroundImage: 'none',
            }}
          >
            <Table sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow
                  sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}
                >
                  <TableCell
                    sx={{
                      color: '#94A3B8',
                      fontWeight: 600,
                      borderBottom: 'none',
                    }}
                  >
                    ORIGINAL
                  </TableCell>
                  <TableCell
                    sx={{
                      color: '#94A3B8',
                      fontWeight: 600,
                      borderBottom: 'none',
                    }}
                  >
                    PHONETIC
                  </TableCell>
                  <TableCell
                    sx={{
                      color: '#94A3B8',
                      fontWeight: 600,
                      borderBottom: 'none',
                    }}
                  >
                    LANGUAGE
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color: '#94A3B8',
                      fontWeight: 600,
                      borderBottom: 'none',
                    }}
                  ></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEntries?.map((entry) => (
                  <TableRow
                    key={entry.id}
                    hover
                    sx={{
                      '&:last-child td, &:last-child th': { border: 0 },
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.02) !important',
                      },
                    }}
                  >
                    <TableCell
                      sx={{
                        color: '#FFFFFF',
                        fontWeight: 500,
                        borderBottom: 'none',
                      }}
                    >
                      {entry.word}
                    </TableCell>
                    <TableCell
                      sx={{
                        color: '#FF8A80',
                        fontFamily: 'var(--font-geist-mono)',
                        borderBottom: 'none',
                      }}
                    >
                      {entry.phonetic_replacement}
                    </TableCell>
                    <TableCell sx={{ borderBottom: 'none' }}>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 2 }}
                      >
                        <Typography
                          sx={{
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                          }}
                        >
                          {entry.language === 'ru-RU'
                            ? '🇷🇺 Русский'
                            : entry.language === 'ro-RO'
                              ? '🇷🇴 Română'
                              : entry.language === 'en-US'
                                ? '🇺🇸 English'
                                : entry.language}
                        </Typography>
                        <Chip
                          label={
                            entry.entry_type
                              ? entry.entry_type.charAt(0).toUpperCase() +
                                entry.entry_type.slice(1)
                              : 'Word'
                          }
                          size="small"
                          sx={{
                            bgcolor: 'rgba(255, 255, 255, 0.08)',
                            color: '#E2E8F0',
                            borderRadius: 1,
                            fontWeight: 500,
                          }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        borderBottom: 'none',
                        display: 'flex',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <IconButton
                        size="small"
                        sx={{
                          color: '#94A3B8',
                          mr: 1,
                          '&:hover': {
                            color: '#82B1FF',
                            bgcolor: 'rgba(130, 177, 255, 0.1)',
                          },
                        }}
                        onClick={() => {
                          setEditingEntry(entry);
                          setModalOpen(true);
                        }}
                        title="Edit Entry"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        sx={{
                          color: '#94A3B8',
                          mr: 1,
                          '&:hover': {
                            color: '#FF5252',
                            bgcolor: 'rgba(255, 82, 82, 0.1)',
                          },
                        }}
                        onClick={() => {
                          if (entry.id) {
                            setEntryToDelete({ id: entry.id, word: entry.word });
                          }
                        }}
                        title="Delete Entry"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Container>

      <DictionaryModal
        key={editingEntry ? `edit-${editingEntry.id}` : 'new'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialData={editingEntry}
      />

      <ConfirmModal
        open={!!entryToDelete}
        onClose={() => setEntryToDelete(null)}
        onConfirm={() => {
          if (entryToDelete) {
            deleteMutation.mutate(entryToDelete.id);
          }
        }}
        title="Delete Dictionary Entry"
        message={`Are you sure you want to delete the phonetic rule for "${entryToDelete?.word}"? This action cannot be undone.`}
        confirmText="Delete"
        isPending={deleteMutation.isPending}
      />
    </Box>
  );
}
