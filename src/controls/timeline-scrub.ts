import { MISSION_DURATION_HOURS } from '../constants';
import type { Timeline } from './timeline';

interface GranularityLevel {
  multiplier: number;
  label: string;
}

// Piecewise-linear granularity zones based on vertical offset from slider
const GRANULARITY_ZONES: { offset: number; multiplier: number; label: string }[] = [
  { offset: 0,   multiplier: 1.0,  label: '' },
  { offset: 40,  multiplier: 0.5,  label: 'Half Speed' },
  { offset: 80,  multiplier: 0.25, label: 'Quarter Speed' },
  { offset: 120, multiplier: 0.1,  label: 'Fine' },
  { offset: 160, multiplier: 0.05, label: 'Ultra Fine' },
];

function getGranularity(verticalOffset: number): GranularityLevel {
  const offset = Math.max(0, verticalOffset);

  // Find the surrounding breakpoints and interpolate
  for (let i = 0; i < GRANULARITY_ZONES.length - 1; i++) {
    const lo = GRANULARITY_ZONES[i];
    const hi = GRANULARITY_ZONES[i + 1];
    if (offset <= hi.offset) {
      const t = (offset - lo.offset) / (hi.offset - lo.offset);
      const multiplier = lo.multiplier + t * (hi.multiplier - lo.multiplier);
      // Use the label of whichever zone we're closer to
      const label = t < 0.5 ? lo.label : hi.label;
      return { multiplier, label };
    }
  }

  // Beyond last zone
  const last = GRANULARITY_ZONES[GRANULARITY_ZONES.length - 1];
  return { multiplier: last.multiplier, label: last.label };
}

export class TimelineScrubController {
  private active = false;
  private anchorMET = 0;
  private touchStartX = 0;
  private sliderCenterY = 0;
  private prevMultiplier = 1.0;

  private sliderEl: HTMLInputElement;
  private sliderRow: HTMLElement;
  private timeline: Timeline;
  private liveState: { isLive: boolean };
  private granularityLabel: HTMLElement | null = null;

  // Bound handlers for cleanup
  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchMove: (e: TouchEvent) => void;
  private boundTouchEnd: (e: TouchEvent) => void;

  constructor({ timeline, liveState, sliderEl, sliderRow }: {
    timeline: Timeline;
    liveState: { isLive: boolean };
    sliderEl: HTMLInputElement;
    sliderRow: HTMLElement;
  }) {
    this.timeline = timeline;
    this.liveState = liveState;
    this.sliderEl = sliderEl;
    this.sliderRow = sliderRow;

    this.boundTouchStart = this.onTouchStart.bind(this);
    this.boundTouchMove = this.onTouchMove.bind(this);
    this.boundTouchEnd = this.onTouchEnd.bind(this);
  }

  attach(): void {
    this.sliderRow.addEventListener('touchstart', this.boundTouchStart, { passive: false });
    this.granularityLabel = this.createGranularityLabel();
    this.sliderRow.appendChild(this.granularityLabel);
  }

  detach(): void {
    this.sliderRow.removeEventListener('touchstart', this.boundTouchStart);
    this.endScrub();
    this.granularityLabel?.remove();
    this.granularityLabel = null;
  }

  isScrubbing(): boolean {
    return this.active;
  }

  private onTouchStart(e: TouchEvent): void {
    // Only handle single-finger touches
    if (e.touches.length !== 1) return;

    e.preventDefault();
    e.stopPropagation();

    const touch = e.touches[0];
    const rect = this.sliderEl.getBoundingClientRect();

    this.active = true;
    this.anchorMET = this.timeline.state.currentMET;
    this.touchStartX = touch.clientX;
    this.sliderCenterY = rect.top + rect.height / 2;
    this.prevMultiplier = 1.0;

    // Disable live mode and pause (same as native slider behavior)
    this.liveState.isLive = false;
    if (this.timeline.state.isPlaying) {
      this.timeline.togglePlayPause();
    }

    // Visual feedback
    this.sliderEl.classList.add('scrubbing');

    document.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    document.addEventListener('touchend', this.boundTouchEnd);
    document.addEventListener('touchcancel', this.boundTouchEnd);
  }

  private onTouchMove(e: TouchEvent): void {
    if (!this.active) return;

    // Abort if second finger appears
    if (e.touches.length > 1) {
      this.endScrub();
      return;
    }

    e.preventDefault();

    const touch = e.touches[0];
    const sliderRect = this.sliderEl.getBoundingClientRect();
    const sliderWidth = sliderRect.width;

    // Vertical offset from slider center (only positive = below)
    const verticalOffset = touch.clientY - this.sliderCenterY;
    const granularity = getGranularity(verticalOffset);

    // Rebase anchor when multiplier changes to prevent value jumps
    if (Math.abs(granularity.multiplier - this.prevMultiplier) > 0.001) {
      this.anchorMET = this.timeline.state.currentMET;
      this.touchStartX = touch.clientX;
      this.prevMultiplier = granularity.multiplier;
    }

    // Convert horizontal pixel delta to MET hours
    const horizontalDelta = touch.clientX - this.touchStartX;
    const hoursPerPx = MISSION_DURATION_HOURS / sliderWidth;
    const metDelta = horizontalDelta * hoursPerPx * granularity.multiplier;

    const newMET = Math.max(0, Math.min(this.anchorMET + metDelta, MISSION_DURATION_HOURS));
    this.timeline.setMET(newMET);
    this.sliderEl.value = String(newMET);

    // Update label
    this.updateGranularityLabel(granularity, touch.clientX, sliderRect);
  }

  private onTouchEnd(_e: TouchEvent): void {
    this.endScrub();
  }

  private endScrub(): void {
    this.active = false;
    this.sliderEl.classList.remove('scrubbing');

    if (this.granularityLabel) {
      this.granularityLabel.classList.remove('visible');
    }

    document.removeEventListener('touchmove', this.boundTouchMove);
    document.removeEventListener('touchend', this.boundTouchEnd);
    document.removeEventListener('touchcancel', this.boundTouchEnd);
  }

  private updateGranularityLabel(
    granularity: GranularityLevel,
    touchX: number,
    sliderRect: DOMRect,
  ): void {
    if (!this.granularityLabel) return;

    if (!granularity.label) {
      this.granularityLabel.classList.remove('visible');
      return;
    }

    this.granularityLabel.textContent = granularity.label;
    this.granularityLabel.classList.add('visible');

    // Position horizontally centered on touch, clamped to slider bounds
    const labelWidth = this.granularityLabel.offsetWidth;
    const relX = touchX - sliderRect.left;
    const clampedX = Math.max(0, Math.min(relX - labelWidth / 2, sliderRect.width - labelWidth));
    this.granularityLabel.style.left = `${clampedX}px`;
  }

  private createGranularityLabel(): HTMLElement {
    const label = document.createElement('div');
    label.className = 'granularity-label';
    return label;
  }
}
