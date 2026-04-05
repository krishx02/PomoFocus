import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TimerDisplay, formatTime } from './timer-display.js';

describe('TimerDisplay', () => {
  afterEach(() => {
    cleanup();
  });

  it('formats 1500 seconds as 25:00', () => {
    render(<TimerDisplay timeRemaining={1500} status="Focusing" />);

    expect(screen.getByText('25:00')).toBeDefined();
  });

  it('formats 299 seconds as 04:59', () => {
    render(<TimerDisplay timeRemaining={299} status="Short Break" />);

    expect(screen.getByText('04:59')).toBeDefined();
  });

  it('formats 0 seconds as 00:00', () => {
    render(<TimerDisplay timeRemaining={0} status="Completed" />);

    expect(screen.getByText('00:00')).toBeDefined();
  });

  it('displays the status label', () => {
    render(<TimerDisplay timeRemaining={1500} status="Focusing" />);

    expect(screen.getByText('Focusing')).toBeDefined();
  });

  it('supports arbitrary status strings (Break)', () => {
    render(<TimerDisplay timeRemaining={300} status="Break" />);

    expect(screen.getByText('Break')).toBeDefined();
    expect(screen.getByText('05:00')).toBeDefined();
  });

  it('renders both status and countdown together', () => {
    render(<TimerDisplay timeRemaining={720} status="Paused" />);

    expect(screen.getByTestId('timer-status')).toBeDefined();
    expect(screen.getByTestId('timer-countdown')).toBeDefined();
    expect(screen.getByText('Paused')).toBeDefined();
    expect(screen.getByText('12:00')).toBeDefined();
  });

  it('uses the default testID of "timer-display"', () => {
    render(<TimerDisplay timeRemaining={1500} status="Focusing" />);

    expect(screen.getByTestId('timer-display')).toBeDefined();
  });

  it('accepts a custom testID', () => {
    render(
      <TimerDisplay
        timeRemaining={1500}
        status="Focusing"
        testID="my-timer"
      />,
    );

    expect(screen.getByTestId('my-timer')).toBeDefined();
  });
});

describe('formatTime', () => {
  it('formats 1500 seconds as 25:00', () => {
    expect(formatTime(1500)).toBe('25:00');
  });

  it('formats 299 seconds as 04:59', () => {
    expect(formatTime(299)).toBe('04:59');
  });

  it('formats 0 seconds as 00:00', () => {
    expect(formatTime(0)).toBe('00:00');
  });

  it('formats 60 seconds as 01:00', () => {
    expect(formatTime(60)).toBe('01:00');
  });

  it('formats 1 second as 00:01', () => {
    expect(formatTime(1)).toBe('00:01');
  });

  it('formats 3599 seconds as 59:59', () => {
    expect(formatTime(3599)).toBe('59:59');
  });

  it('clamps negative values to 00:00', () => {
    expect(formatTime(-5)).toBe('00:00');
  });

  it('truncates fractional seconds', () => {
    expect(formatTime(59.9)).toBe('00:59');
  });
});
