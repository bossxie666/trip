"use client";

import { Component, Fragment, type ReactNode } from "react";

/** A provider rendering error must not replace the itinerary with an error page. */
export class MapRecoveryBoundary extends Component<{ children: ReactNode }, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { console.warn("Map renderer failed; itinerary remains available."); }
  render() {
    if (this.state.failed) return <section className="map-recovery" role="alert"><p>地图暂时无法显示，行程内容仍可使用。</p><button type="button" onClick={() => this.setState(({ attempt }) => ({ failed: false, attempt: attempt + 1 }))}>重新加载地图</button></section>;
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
  }
}
