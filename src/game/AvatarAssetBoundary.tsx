import { Component, type ReactNode } from 'react';

type Props = {
  appearance: string;
  fallback: ReactNode;
  children: ReactNode;
  retryAssets?: () => void;
};

/** Optional clothing must never take down the campus, controls or other players. */
export default class AvatarAssetBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  private timer: ReturnType<typeof setTimeout> | undefined;
  private retried = false;

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn('Avatar appearance unavailable; retaining a base character.', error.message);
    if (!this.retried && this.props.retryAssets && /load|fetch|network/i.test(error.message)) {
      this.retried = true;
      this.timer = setTimeout(() => {
        this.props.retryAssets?.();
        this.setState({ failed: false });
      }, 1500);
    }
  }

  componentDidUpdate(previous: Props) {
    if (previous.appearance !== this.props.appearance) {
      clearTimeout(this.timer);
      this.retried = false;
      if (this.state.failed) this.setState({ failed: false });
    }
  }

  componentWillUnmount() {
    clearTimeout(this.timer);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
