import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ProcessGoal } from '@pomofocus/types';

/**
 * Minimal view-model shape accepted by GoalPicker.
 *
 * Uses `Pick<ProcessGoal, 'id' | 'title'>` from `@pomofocus/types` so the
 * UI stays coupled only to the fields it renders, and adds an optional
 * `description` field that callers can supply from any source.
 */
export type GoalPickerItem = Pick<ProcessGoal, 'id' | 'title'> & {
  readonly description?: string;
};

export type GoalPickerProps = {
  readonly goals: readonly GoalPickerItem[];
  readonly selectedId: string | null;
  readonly onSelect: (goalId: string) => void;
};

/**
 * Presentational goal selector. Renders a list of goals with radio-style
 * single selection. Fires `onSelect(goalId)` when a row is pressed.
 *
 * This component is pure presentation — it receives goals and selection
 * state via props and emits a callback on selection. No state management,
 * no data fetching, no business logic.
 */
export function GoalPicker({
  goals,
  selectedId,
  onSelect,
}: GoalPickerProps): ReactNode {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Choose a goal"
    >
      {goals.map((goal) => {
        const isSelected = goal.id === selectedId;
        return (
          <Pressable
            key={goal.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected, checked: isSelected }}
            accessibilityLabel={goal.title}
            onPress={() => {
              onSelect(goal.id);
            }}
            testID={`goal-picker-item-${goal.id}`}
          >
            <View>
              <Text>{isSelected ? '\u25CF' : '\u25CB'}</Text>
              <Text>{goal.title}</Text>
              {goal.description !== undefined && goal.description !== '' ? (
                <Text>{goal.description}</Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
