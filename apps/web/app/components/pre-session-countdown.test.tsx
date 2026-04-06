import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, cleanup, fireEvent } from '@testing-library/react';
import {
  PreSessionCountdown,
  DEFAULT_COUNTDOWN_SECONDS,
} from './pre-session-countdown.js';

describe('PreSessionCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  describe('rendering', () => {
    it('renders the starting label', () => {
      render(
        <PreSessionCountdown
          goalId="goal-1"
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      expect(screen.getByText('Starting in')).toBeDefined();
    });

    it('renders the default duration value initially', () => {
      render(
        <PreSessionCountdown
          goalId="goal-1"
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      expect(screen.getByTestId('pre-session-countdown-value').textContent).toBe(
        String(DEFAULT_COUNTDOWN_SECONDS),
      );
    });

    it('renders a custom duration value when provided', () => {
      render(
        <PreSessionCountdown
          goalId="goal-1"
          durationSeconds={5}
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      expect(screen.getByTestId('pre-session-countdown-value').textContent).toBe('5');
    });

    it('renders a progress bar', () => {
      render(
        <PreSessionCountdown
          goalId="goal-1"
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      expect(screen.getByTestId('pre-session-countdown-progress')).toBeDefined();
    });

    it('renders a Cancel button', () => {
      render(
        <PreSessionCountdown
          goalId="goal-1"
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();
    });
  });

  describe('countdown decrement', () => {
    it('decrements by one after one second', () => {
      render(
        <PreSessionCountdown
          goalId="goal-1"
          durationSeconds={5}
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      expect(screen.getByTestId('pre-session-countdown-value').textContent).toBe('5');

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByTestId('pre-session-countdown-value').textContent).toBe('4');
    });

    it('decrements every second until reaching zero', () => {
      render(
        <PreSessionCountdown
          goalId="goal-1"
          durationSeconds={3}
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      expect(screen.getByTestId('pre-session-countdown-value').textContent).toBe('3');

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByTestId('pre-session-countdown-value').textContent).toBe('2');

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByTestId('pre-session-countdown-value').textContent).toBe('1');

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByTestId('pre-session-countdown-value').textContent).toBe('0');
    });

    it('updates progress bar width as countdown advances', () => {
      render(
        <PreSessionCountdown
          goalId="goal-1"
          durationSeconds={4}
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      const fill = screen.getByTestId('pre-session-countdown-progress-fill');

      // At start (0 of 4 seconds elapsed), width should be 0px.
      expect(fill.style.width).toBe('0px');

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // After 2 of 4 seconds, progress should be 50% of 240px = 120px.
      expect(fill.style.width).toBe('120px');
    });
  });

  describe('onComplete callback', () => {
    it('fires onComplete when countdown reaches zero', () => {
      const onComplete = vi.fn();

      render(
        <PreSessionCountdown
          goalId="goal-1"
          onComplete={onComplete}
          onCancel={vi.fn()}
          durationSeconds={2}
        />,
      );

      expect(onComplete).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(onComplete).toHaveBeenCalledOnce();
    });

    it('passes goalId and intentionText to onComplete', () => {
      const onComplete = vi.fn();

      render(
        <PreSessionCountdown
          goalId="goal-42"
          intentionText="Finish the report"
          onComplete={onComplete}
          onCancel={vi.fn()}
          durationSeconds={1}
        />,
      );

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onComplete).toHaveBeenCalledWith('goal-42', 'Finish the report');
    });

    it('passes undefined intentionText when not provided', () => {
      const onComplete = vi.fn();

      render(
        <PreSessionCountdown
          goalId="goal-42"
          onComplete={onComplete}
          onCancel={vi.fn()}
          durationSeconds={1}
        />,
      );

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onComplete).toHaveBeenCalledWith('goal-42', undefined);
    });

    it('does not fire onComplete before reaching zero', () => {
      const onComplete = vi.fn();

      render(
        <PreSessionCountdown
          goalId="goal-1"
          onComplete={onComplete}
          onCancel={vi.fn()}
          durationSeconds={5}
        />,
      );

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(onComplete).not.toHaveBeenCalled();
    });
  });

  describe('onCancel callback', () => {
    it('fires onCancel when Cancel is pressed', () => {
      const onCancel = vi.fn();

      render(
        <PreSessionCountdown
          goalId="goal-1"
          onComplete={vi.fn()}
          onCancel={onCancel}
          durationSeconds={5}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onCancel).toHaveBeenCalledOnce();
    });

    it('does not fire onComplete when cancelled before reaching zero', () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      render(
        <PreSessionCountdown
          goalId="goal-1"
          onComplete={onComplete}
          onCancel={onCancel}
          durationSeconds={5}
        />,
      );

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onCancel).toHaveBeenCalledOnce();
      expect(onComplete).not.toHaveBeenCalled();
    });
  });
});
