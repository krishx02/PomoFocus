import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TextInput } from './text-input.js';

describe('TextInput', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders with the provided value', () => {
    render(
      <TextInput
        value="hello"
        onChangeText={(): void => undefined}
        accessibilityLabel="Greeting"
      />,
    );

    const input = screen.getByLabelText<HTMLInputElement>('Greeting');
    expect(input.value).toBe('hello');
  });

  it('renders the label when provided', () => {
    render(
      <TextInput
        value=""
        label="Your name"
        onChangeText={(): void => undefined}
      />,
    );

    expect(screen.getByText('Your name')).toBeDefined();
  });

  it('calls onChangeText when user types', () => {
    const handleChange = vi.fn();
    render(
      <TextInput
        value=""
        onChangeText={handleChange}
        accessibilityLabel="Field"
      />,
    );

    const input = screen.getByLabelText('Field');
    fireEvent.change(input, { target: { value: 'typed' } });

    expect(handleChange).toHaveBeenCalledWith('typed');
  });

  it('falls back to label as accessibilityLabel when none is provided', () => {
    render(
      <TextInput
        value=""
        label="Email"
        onChangeText={(): void => undefined}
      />,
    );

    expect(screen.getByLabelText('Email')).toBeDefined();
  });

  describe('error state', () => {
    it('displays the error message when error is provided', () => {
      render(
        <TextInput
          value="bad"
          error="Value is invalid"
          onChangeText={(): void => undefined}
          accessibilityLabel="Field"
        />,
      );

      expect(screen.getByText('Value is invalid')).toBeDefined();
    });

    it('does not show any error text when error prop is absent', () => {
      render(
        <TextInput
          value="ok"
          onChangeText={(): void => undefined}
          accessibilityLabel="Field"
          testID="no-error-input"
        />,
      );

      expect(screen.queryByText(/invalid/i)).toBeNull();
    });

    it('applies error border styling when error is set', () => {
      render(
        <TextInput
          value="bad"
          error="Too short"
          onChangeText={(): void => undefined}
          accessibilityLabel="Field"
        />,
      );

      const input = screen.getByLabelText('Field');
      // react-native-web splits border shorthand into longhand properties;
      // error border is #DC2626 → rgb(220, 38, 38)
      expect(input.style.borderTopColor).toBe('rgb(220, 38, 38)');
      expect(input.style.borderRightColor).toBe('rgb(220, 38, 38)');
      expect(input.style.borderBottomColor).toBe('rgb(220, 38, 38)');
      expect(input.style.borderLeftColor).toBe('rgb(220, 38, 38)');
    });

    it('does not apply error styling when no error is set', () => {
      render(
        <TextInput
          value="ok"
          onChangeText={(): void => undefined}
          accessibilityLabel="Field"
        />,
      );

      const input = screen.getByLabelText('Field');
      // Normal border is #D1D5DB → rgb(209, 213, 219)
      expect(input.style.borderTopColor).toBe('rgb(209, 213, 219)');
      expect(input.style.borderRightColor).toBe('rgb(209, 213, 219)');
      expect(input.style.borderBottomColor).toBe('rgb(209, 213, 219)');
      expect(input.style.borderLeftColor).toBe('rgb(209, 213, 219)');
    });
  });

  describe('character counter', () => {
    it('shows character count when showCharacterCount and maxLength are provided', () => {
      render(
        <TextInput
          value="abcd"
          maxLength={10}
          showCharacterCount
          onChangeText={(): void => undefined}
          accessibilityLabel="Field"
        />,
      );

      expect(screen.getByText('4/10')).toBeDefined();
    });

    it('updates the counter as value changes on re-render', () => {
      const { rerender } = render(
        <TextInput
          value="ab"
          maxLength={5}
          showCharacterCount
          onChangeText={(): void => undefined}
          accessibilityLabel="Field"
        />,
      );

      expect(screen.getByText('2/5')).toBeDefined();

      rerender(
        <TextInput
          value="abcde"
          maxLength={5}
          showCharacterCount
          onChangeText={(): void => undefined}
          accessibilityLabel="Field"
        />,
      );

      expect(screen.getByText('5/5')).toBeDefined();
    });

    it('does not show counter when showCharacterCount is false', () => {
      render(
        <TextInput
          value="abc"
          maxLength={10}
          onChangeText={(): void => undefined}
          accessibilityLabel="Field"
        />,
      );

      expect(screen.queryByText('3/10')).toBeNull();
    });

    it('does not show counter when maxLength is absent', () => {
      render(
        <TextInput
          value="abc"
          showCharacterCount
          onChangeText={(): void => undefined}
          accessibilityLabel="Field"
        />,
      );

      expect(screen.queryByText(/\d+\/\d+/)).toBeNull();
    });
  });
});
