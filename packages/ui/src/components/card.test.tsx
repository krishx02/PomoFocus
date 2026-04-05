import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Text } from 'react-native';
import { Card } from './card.js';

describe('Card', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders its children', () => {
    render(
      <Card>
        <Text>Hello card</Text>
      </Card>,
    );

    expect(screen.getByText('Hello card')).toBeDefined();
  });

  it('uses the default testID of "card"', () => {
    render(
      <Card>
        <Text>Body</Text>
      </Card>,
    );

    expect(screen.getByTestId('card')).toBeDefined();
  });

  it('accepts a custom testID', () => {
    render(
      <Card testID="my-card">
        <Text>Body</Text>
      </Card>,
    );

    expect(screen.getByTestId('my-card')).toBeDefined();
  });

  it('applies padding and border radius styles', () => {
    render(
      <Card testID="styled-card">
        <Text>Body</Text>
      </Card>,
    );

    const node = screen.getByTestId('styled-card');
    // On react-native-web, View styles are flattened to DOM inline styles.
    // `borderRadius` expands to the four per-corner CSS properties.
    const inlineStyle = node.getAttribute('style') ?? '';
    expect(inlineStyle).toContain('padding');
    expect(inlineStyle).toContain('border-top-left-radius');
    expect(inlineStyle).toContain('border-bottom-right-radius');
  });

  it('merges caller-provided style with the default card style', () => {
    render(
      <Card testID="merged-card" style={{ backgroundColor: 'rgb(255, 0, 0)' }}>
        <Text>Body</Text>
      </Card>,
    );

    const node = screen.getByTestId('merged-card');
    const inlineStyle = node.getAttribute('style') ?? '';
    // Base padding still present
    expect(inlineStyle).toContain('padding');
    // Override applied
    expect(inlineStyle).toContain('rgb(255, 0, 0)');
  });

  it('renders multiple children', () => {
    render(
      <Card>
        <Text>First</Text>
        <Text>Second</Text>
      </Card>,
    );

    expect(screen.getByText('First')).toBeDefined();
    expect(screen.getByText('Second')).toBeDefined();
  });
});
