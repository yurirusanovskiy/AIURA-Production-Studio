'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Button,
  Grid,
  IconButton,
  Container,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBackOutlined';
import EditNoteIcon from '@mui/icons-material/EditNoteOutlined';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  projectService,
  sceneService,
  getLanguageDisplayName,
} from '@/lib/api';
import DeleteProjectModal from '@/components/modals/DeleteProjectModal';
import CastingDirectorSection from '@/components/CastingDirectorSection';
import ItemCard from '@/components/cards/ItemCard';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';

export default function ProjectDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [deleteOpen, setDeleteOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => projectService.deleteProject(id as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      router.push('/');
    },
  });

  const deleteSceneMutation = useMutation({
    mutationFn: (sceneId: string) => sceneService.deleteScene(sceneId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenes', id] });
    },
  });

  const handleDeleteScene = (sceneId: string) => {
    if (confirm('Are you sure you want to delete this chapter?')) {
      deleteSceneMutation.mutate(sceneId);
    }
  };

  const updateProjectMutation = useMutation({
    mutationFn: (data: { tts_model: string }) =>
      projectService.updateProject(id as string, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    },
  });

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectService.getProject(id as string),
    enabled: !!id,
  });

  const { data: scenes, isLoading: scenesLoading } = useQuery({
    queryKey: ['scenes', id],
    queryFn: () => sceneService.getScenes(id as string),
    enabled: !!id,
  });

  if (projectLoading || scenesLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '80vh',
        }}
      >
        <CircularProgress sx={{ color: '#82B1FF' }} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        p: { xs: 2, md: 4 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <IconButton
          onClick={() => router.push('/')}
          sx={{
            mr: 2,
            color: '#94A3B8',
            bgcolor: 'rgba(255,255,255,0.05)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontWeight: 600, color: '#FFFFFF' }}
          >
            {project?.title || 'Project Details'}
          </Typography>
          <Typography variant="body1" sx={{ color: '#94A3B8' }}>
            {getLanguageDisplayName(project?.language_code)} •{' '}
            {scenes?.length || 0} Chapters
          </Typography>
        </Box>

        {project && (
          <FormControl
            size="small"
            sx={{
              minWidth: 200,
              mr: 2,
              '& .MuiOutlinedInput-root': {
                color: '#FFF',
                bgcolor: 'rgba(255,255,255,0.05)',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                '&.Mui-focused fieldset': { borderColor: '#82B1FF' },
              },
              '& .MuiInputLabel-root': { color: '#94A3B8' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#82B1FF' },
            }}
          >
            <InputLabel>TTS Model</InputLabel>
            <Select
              label="TTS Model"
              value={project.tts_model || 'gemini-3.1-flash-tts-preview'}
              onChange={(e) =>
                updateProjectMutation.mutate({
                  tts_model: e.target.value as string,
                })
              }
              disabled={updateProjectMutation.isPending}
            >
              <MenuItem value="gemini-2.5-pro-preview-tts">
                gemini-2.5-pro-preview
              </MenuItem>
              <MenuItem value="gemini-3.1-flash-tts-preview">
                gemini-3.1-flash-preview
              </MenuItem>
            </Select>
          </FormControl>
        )}

        <Button
          variant="outlined"
          color="error"
          onClick={() => setDeleteOpen(true)}
          sx={{
            px: 2,
            py: 1.5,
            borderRadius: 2,
            minWidth: 'auto',
          }}
        >
          <DeleteOutlinedIcon />
        </Button>
      </Box>

      <Container maxWidth="xl" sx={{ px: '0 !important' }}>
        {project && (
          <CastingDirectorSection
            projectId={project.id!}
            scenes={scenes || []}
          />
        )}

        <Typography
          variant="h5"
          sx={{ color: '#FFFFFF', fontWeight: 600, mb: 3 }}
        >
          Chapters
        </Typography>

        <Grid container spacing={3}>
          {scenes?.map((scene) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={scene.id}>
               <ItemCard
                 title={scene.title}
                 topRightActions={
                   <IconButton
                     size="small"
                     onClick={(e) => {
                       e.stopPropagation();
                       if (scene.id) handleDeleteScene(scene.id);
                     }}
                     sx={{
                       color: '#F44336',
                       bgcolor: 'rgba(244, 67, 54, 0.05)',
                       '&:hover': {
                         bgcolor: 'rgba(244, 67, 54, 0.15)',
                       },
                     }}
                   >
                     <DeleteOutlinedIcon fontSize="small" />
                   </IconButton>
                 }
                 chips={[
                   {
                     label:
                       scene.status === 'draft'
                         ? 'Draft'
                         : scene.status === 'extracted'
                           ? 'Script Extracted'
                           : scene.status === 'error'
                             ? 'Error'
                             : 'Completed',
                     bgcolor:
                       scene.status === 'completed'
                         ? 'rgba(76, 175, 80, 0.1)'
                         : scene.status === 'error'
                           ? 'rgba(244, 67, 54, 0.1)'
                           : 'rgba(255,255,255,0.05)',
                     color:
                       scene.status === 'completed'
                         ? '#4CAF50'
                         : scene.status === 'error'
                           ? '#F44336'
                           : '#94A3B8',
                   },
                 ]}
                 description={
                   scene.raw_text
                     ? `${scene.raw_text.substring(0, 150)}...`
                     : undefined
                 }
                 actionButton={{
                   text: 'Open Editor',
                   startIcon: <EditNoteIcon />,
                   onClick: () =>
                     router.push(`/projects/${id}/scenes/${scene.id}`),
                 }}
               />
            </Grid>
          ))}
          {scenes?.length === 0 && (
            <Grid size={{ xs: 12 }}>
              <Box sx={{ textAlign: 'center', py: 10 }}>
                <Typography variant="h6" color="#94A3B8">
                  No chapters generated yet.
                </Typography>
              </Box>
            </Grid>
          )}
        </Grid>
      </Container>

      {/* Delete Project Modal */}
      {project && (
        <DeleteProjectModal
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onConfirm={() => deleteMutation.mutate()}
          projectTitle={project.title}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </Box>
  );
}
