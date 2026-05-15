import React from 'react';
import { Container, Typography, Box } from '@mui/material';

const About: React.FC = () => {
  return (
    <Container>
      <Box sx={{ py: 5, textAlign: 'center' }}>
        <Typography variant="h1" gutterBottom>
          About API Glue
        </Typography>
        <Typography variant="body1" color="text.secondary">
          API Glue offers a modern solution to seamlessly integrate your services
          with a unified interface for better customer satisfaction and retention.
        </Typography>
      </Box>
    </Container>
  );
};

export default About;