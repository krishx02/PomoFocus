import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Button, BUTTON_VARIANT } from './button.js';

describe('Button', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders with the given label', () => {
    render(<Button label="Start" onPress={(): void => undefined} />);

    expect(screen.getByRole('button', { name: 'Start' })).toBeDefined();
  });

  it('fires onPress when clicked', () => {
    const handlePress = vi.fn();
    render(<Button label="Start" onPress={handlePress} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    expect(handlePress).toHaveBeenCalledOnce();
  });

  it('uses label as default accessibilityLabel', () => {
    render(<Button label="Submit" onPress={(): void => undefined} />);

    expect(screen.getByRole('button', { name: 'Submit' })).toBeDefined();
  });

  it('honors a custom accessibilityLabel when provided', () => {
    render(
      <Button
        label="X"
        accessibilityLabel="Close dialog"
        onPress={(): void => undefined}
      />,
    );

    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeDefined();
  });

  it('does not fire onPress when disabled', () => {
    const handlePress = vi.fn();
    render(<Button label="Start" disabled onPress={handlePress} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    expect(handlePress).not.toHaveBeenCalled();
  });

  describe('variants', () => {
    it('renders primary variant by default', () => {
      render(
        <Button
          label="Primary"
          onPress={(): void => undefined}
          testID="btn-primary"
        />,
      );

      const button = screen.getByTestId('btn-primary');
      expect(button).toBeDefined();
      // Primary background is dark (#1F2937 → rgb(31, 41, 55))
      expect(button.style.backgroundColor).toBe('rgb(31, 41, 55)');
    });

    it('renders secondary variant with its own background', () => {
      render(
        <Button
          label="Secondary"
          variant={BUTTON_VARIANT.SECONDARY}
          onPress={(): void => undefined}
          testID="btn-secondary"
        />,
      );

      const button = screen.getByTestId('btn-secondary');
      // Secondary background is light gray (#E5E7EB → rgb(229, 231, 235))
      expect(button.style.backgroundColor).toBe('rgb(229, 231, 235)');
    });

    it('renders ghost variant with transparent background', () => {
      render(
        <Button
          label="Ghost"
          variant={BUTTON_VARIANT.GHOST}
          onPress={(): void => undefined}
          testID="btn-ghost"
        />,
      );

      const button = screen.getByTestId('btn-ghost');
      // Ghost background is transparent — react-native-web serializes to rgba(0, 0, 0, 0)
      expect(button.style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    });

    it('applies distinct styles across all three variants', () => {
      const { rerender } = render(
        <Button
          label="Test"
          variant={BUTTON_VARIANT.PRIMARY}
          onPress={(): void => undefined}
          testID="btn-test"
        />,
      );
      const primaryBg = screen.getByTestId('btn-test').style.backgroundColor;

      rerender(
        <Button
          label="Test"
          variant={BUTTON_VARIANT.SECONDARY}
          onPress={(): void => undefined}
          testID="btn-test"
        />,
      );
      const secondaryBg = screen.getByTestId('btn-test').style.backgroundColor;

      rerender(
        <Button
          label="Test"
          variant={BUTTON_VARIANT.GHOST}
          onPress={(): void => undefined}
          testID="btn-test"
        />,
      );
      const ghostBg = screen.getByTestId('btn-test').style.backgroundColor;

      expect(primaryBg).not.toBe(secondaryBg);
      expect(secondaryBg).not.toBe(ghostBg);
      expect(primaryBg).not.toBe(ghostBg);
    });
  });
});
