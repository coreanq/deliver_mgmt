<template>
  <v-fab
    location="bottom end"
    size="large"
    color="success"
    class="floating-feedback-btn"
    @click="openFeedbackForm"
    title="피드백 보내기"
    aria-label="피드백 보내기"
  >
    <v-icon>mdi-message</v-icon>
    <v-tooltip activator="parent" location="top">
      피드백 보내기
    </v-tooltip>
  </v-fab>
</template>

<script setup lang="ts">
// Floating feedback button component - opens Google Form for user feedback

const openFeedbackForm = () => {
  const currentUrl = encodeURIComponent(window.location.href)
  const currentPage = encodeURIComponent(document.title || window.location.pathname)
  
  // Google Form URL with prefilled parameters
  // Replace with actual Google Form URL and entry IDs
  const formUrl = `https://docs.google.com/forms/d/e/1FAIpQLSf3MJ5dC5MOpZuo_J8fEN2GME_cg5EJWJcLoPYnsEHlCr_YXA/viewform?usp=dialog&entry.1156169455=${currentUrl}&entry.1203906730=${currentPage}`
  
  // Open form in new tab
  window.open(formUrl, '_blank', 'noopener,noreferrer')
}
</script>

<style scoped>
.floating-feedback-btn {
  /* Custom positioning for feedback button */
  position: fixed !important;
  bottom: 24px !important;
  right: 24px !important;
  z-index: 999 !important;
  
  /* Enhanced visual styling */
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3) !important;
  transition: all 0.3s ease !important;
}

.floating-feedback-btn:hover {
  transform: translateY(-2px) scale(1.05) !important;
  box-shadow: 0 8px 24px rgba(76, 175, 80, 0.4) !important;
}

/* Responsive sizing */
@media (max-width: 768px) {
  .floating-feedback-btn {
    bottom: 20px !important;
    right: 20px !important;
    /* Slightly smaller on mobile */
    transform: scale(0.9) !important;
  }
  
  .floating-feedback-btn:hover {
    transform: translateY(-2px) scale(0.95) !important;
  }
}

/* Ensure it stays above other elements but below critical modals */
.floating-feedback-btn {
  z-index: 999 !important;
}
</style>