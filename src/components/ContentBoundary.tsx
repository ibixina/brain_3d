import { Component, useEffect, useRef, type ReactNode } from "react";

type RecoveryProps = { label: string; className?: string };

export function ContentRecovery({ label, className = "" }: RecoveryProps) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => panel.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [label]);
  return (
    <section
      className={`content-recovery ${className}`}
      aria-label={`${label} unavailable`}
      role="alert"
      tabIndex={-1}
      ref={panel}
    >
      <h3>{label} could not open.</h3>
      <p>Reload to try again. Your current link will be kept.</p>
      <button onClick={() => location.reload()}>Reload this view</button>
    </section>
  );
}

export default class ContentBoundary extends Component<RecoveryProps & { children: ReactNode }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed
      ? <ContentRecovery label={this.props.label} className={this.props.className} />
      : this.props.children;
  }
}
