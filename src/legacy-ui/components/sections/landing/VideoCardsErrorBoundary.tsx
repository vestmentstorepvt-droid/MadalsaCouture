import React from 'react';

interface VideoCardsErrorBoundaryProps {
  children: React.ReactNode;
}

interface VideoCardsErrorBoundaryState {
  hasError: boolean;
}

export class VideoCardsErrorBoundary extends React.Component<
  VideoCardsErrorBoundaryProps,
  VideoCardsErrorBoundaryState
> {
  state: VideoCardsErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): VideoCardsErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    console.error('Homepage video cards failed to render.', error);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <section aria-label="Video stories" className="bg-white py-10 text-center text-sm text-slate-500">
          Video stories are temporarily unavailable.
        </section>
      );
    }
    return this.props.children;
  }
}
