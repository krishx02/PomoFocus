import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { TIMER_STATUS } from '@pomofocus/core';
import type { TimerConfig, TimerState } from '@pomofocus/core';
import { IntentionInput, MAX_INTENTION_LENGTH } from './intention-input.js';

const defaultConfig: TimerConfig = {
  focusDuration: 1500,
  shortBreakDuration: 300,
  longBreakDuration: 900,
  sessionsBeforeLongBreak: 4,
  reflectionEnabled: true,
};

let mockTimerState: TimerState = { status: TIMER_STATUS.IDLE, config: defaultConfig };

vi.mock('@pomofocus/state', () => ({
  useTimerStore: (selector: (store: { state: TimerState }) => unknown) =>
    selector({ state: mockTimerState }),
}));

function setTimerState(state: TimerState): void {
  mockTimerState = state;
}

function Harness({
  initialValue = '',
  onChange,
}: {
  readonly initialValue?: string;
  readonly onChange?: (value: string) => void;
}): React.JSX.Element {
  const [value, setValue] = useState(initialValue);
  return (
    <IntentionInput
      value={value}
      onChangeText={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe('IntentionInput', () => {
  beforeEach(() => {
    setTimerState({ status: TIMER_STATUS.IDLE, config: defaultConfig });
  });

  afterEach(() => {
    cleanup();
  });

  describe('idle state', () => {
    it('renders the input container', () => {
      render(<Harness />);

      expect(screen.getByTestId('intention-input')).toBeDefined();
    });

    it('renders the text input with accessible label', () => {
      render(<Harness />);

      expect(
        screen.getByRole('textbox', { name: 'Session intention' }),
      ).toBeDefined();
    });

    it('starts empty by default (optional)', () => {
      render(<Harness />);

      const input = screen.getByRole('textbox', {
        name: 'Session intention',
      });
      if (!(input instanceof HTMLInputElement)) {
        throw new Error('expected input element');
      }
      expect(input.value).toBe('');
    });

    it('shows initial character count as 0/200', () => {
      render(<Harness />);

      expect(screen.getByTestId('intention-char-count').textContent).toBe(
        '0/200',
      );
    });

    it('updates character count as text is entered', () => {
      render(<Harness />);

      const input = screen.getByRole('textbox', { name: 'Session intention' });
      fireEvent.change(input, { target: { value: 'finish the report' } });

      expect(screen.getByTestId('intention-char-count').textContent).toBe(
        '17/200',
      );
    });

    it('calls onChangeText with the typed value', () => {
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);

      const input = screen.getByRole('textbox', { name: 'Session intention' });
      fireEvent.change(input, { target: { value: 'deep work' } });

      expect(onChange).toHaveBeenCalledWith('deep work');
    });

    it('enforces a 200 character maximum via maxLength attribute', () => {
      render(<Harness />);

      const input = screen.getByRole('textbox', {
        name: 'Session intention',
      });
      if (!(input instanceof HTMLInputElement)) {
        throw new Error('expected input element');
      }

      expect(input.maxLength).toBe(200);
    });

    it('accepts exactly 200 characters', () => {
      render(<Harness />);

      const input = screen.getByRole('textbox', { name: 'Session intention' });
      const twoHundredChars = 'a'.repeat(200);
      fireEvent.change(input, { target: { value: twoHundredChars } });

      expect(screen.getByTestId('intention-char-count').textContent).toBe(
        '200/200',
      );
    });
  });

  describe('non-idle states', () => {
    const nonIdleStates: { name: string; state: TimerState }[] = [
      {
        name: 'focusing',
        state: {
          status: TIMER_STATUS.FOCUSING,
          timeRemaining: 1400,
          startedAt: 1000,
          sessionNumber: 1,
          config: defaultConfig,
        },
      },
      {
        name: 'paused',
        state: {
          status: TIMER_STATUS.PAUSED,
          timeRemaining: 1200,
          pausedAt: 2000,
          sessionNumber: 1,
          config: defaultConfig,
        },
      },
      {
        name: 'short_break',
        state: {
          status: TIMER_STATUS.SHORT_BREAK,
          timeRemaining: 250,
          startedAt: 3000,
          sessionNumber: 1,
          config: defaultConfig,
        },
      },
      {
        name: 'long_break',
        state: {
          status: TIMER_STATUS.LONG_BREAK,
          timeRemaining: 800,
          startedAt: 4000,
          sessionNumber: 4,
          config: defaultConfig,
        },
      },
      {
        name: 'break_paused',
        state: {
          status: TIMER_STATUS.BREAK_PAUSED,
          timeRemaining: 150,
          pausedAt: 5000,
          breakType: 'short',
          sessionNumber: 2,
          config: defaultConfig,
        },
      },
      {
        name: 'reflection',
        state: {
          status: TIMER_STATUS.REFLECTION,
          sessionNumber: 1,
          config: defaultConfig,
        },
      },
      {
        name: 'completed',
        state: {
          status: TIMER_STATUS.COMPLETED,
          sessionNumber: 1,
          config: defaultConfig,
        },
      },
      {
        name: 'abandoned',
        state: {
          status: TIMER_STATUS.ABANDONED,
          sessionNumber: 1,
          abandonedAt: 6000,
          config: defaultConfig,
        },
      },
    ];

    it.each(nonIdleStates)(
      'does not render input in $name state',
      ({ state }) => {
        setTimerState(state);

        render(<Harness />);

        expect(screen.queryByTestId('intention-input')).toBeNull();
        expect(
          screen.queryByRole('textbox', { name: 'Session intention' }),
        ).toBeNull();
      },
    );
  });

  describe('MAX_INTENTION_LENGTH', () => {
    it('is 200', () => {
      expect(MAX_INTENTION_LENGTH).toBe(200);
    });
  });
});
