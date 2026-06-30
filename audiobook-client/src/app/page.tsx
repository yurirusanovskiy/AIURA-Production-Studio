'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Container,
  Chip,
  LinearProgress,
} from '@mui/material';
import Link from 'next/link';
import AddIcon from '@mui/icons-material/Add';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import { useQuery } from '@tanstack/react-query';
import { projectService, getLanguageDisplayName } from '@/lib/api';
import UploadBookModal from '@/components/modals/UploadBookModal';
import ManualProjectModal from '@/components/modals/ManualProjectModal';
import ItemCard from '@/components/cards/ItemCard';

export default function ProjectsPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const {
    data: projects,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['projects'],
    queryFn: projectService.getProjects,
  });

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
          mb: 5,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontWeight: 600, color: '#FFFFFF', mb: 1 }}
          >
            AIURA Studio
          </Typography>
          <Typography variant="body1" sx={{ color: '#94A3B8' }}>
            {projects ? projects.length : 0} active productions
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setUploadOpen(true)}
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
          Create / Upload New Book
        </Button>
      </Box>

      {/* Main Content */}
      <Container maxWidth="xl" sx={{ flexGrow: 1, px: '0 !important' }}>
        {isLoading ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '50vh',
            }}
          >
            <CircularProgress sx={{ color: '#82B1FF' }} />
          </Box>
        ) : error ? (
          <Typography color="error">
            Failed to load projects. Ensure backend is running.
          </Typography>
        ) : (
          <Grid container spacing={3}>
            {/* Project Cards */}
            {projects?.map((project) => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  style={{
                    textDecoration: 'none',
                    display: 'block',
                    height: '100%',
                  }}
                >
                  <ItemCard
                    title={project.title}
                    disableIconBackground={true}
                    iconNode={
                      <MenuBookOutlinedIcon sx={{ color: '#82B1FF' }} />
                    }
                    description={`Создано ${new Date(project.created_at || '').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                    chips={[
                      {
                        label: getLanguageDisplayName(project.language_code),
                      },
                    ]}
                    bottomContent={
                      <Box>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            mb: 1.5,
                          }}
                        >
                          <Typography variant="body2" sx={{ color: '#94A3B8' }}>
                            {project.total_scenes || 0} chapters
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Box sx={{ width: '100%', mr: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={
                                project.total_scenes
                                  ? Math.round(
                                      ((project.completed_scenes || 0) /
                                        project.total_scenes) *
                                        100,
                                    )
                                  : 0
                              }
                              sx={{
                                height: 6,
                                borderRadius: 3,
                                bgcolor: 'rgba(255,255,255,0.05)',
                                '& .MuiLinearProgress-bar': {
                                  bgcolor: '#82B1FF',
                                },
                              }}
                            />
                          </Box>
                          <Typography
                            variant="caption"
                            sx={{ color: '#82B1FF', fontWeight: 600 }}
                          >
                            {project.total_scenes
                              ? Math.round(
                                  ((project.completed_scenes || 0) /
                                    project.total_scenes) *
                                    100,
                                )
                              : 0}
                            %
                          </Typography>
                        </Box>
                      </Box>
                    }
                    actionButton={{
                      text: 'Open Project',
                    }}
                  />
                </Link>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>

      <UploadBookModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
      <ManualProjectModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
      />
    </Box>
  );
}
