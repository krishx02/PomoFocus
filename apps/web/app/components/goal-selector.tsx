import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ProcessGoal } from '@pomofocus/core';

type GoalSelectorProps = {
  readonly goals: readonly ProcessGoal[];
  readonly selectedGoalId: string | null;
  readonly onSelect: (goalId: string) => void;
};

function GoalSelector({
  goals,
  selectedGoalId,
  onSelect,
}: GoalSelectorProps): React.JSX.Element {
  if (goals.length === 0) {
    return (
      <View testID="goal-selector" style={styles.container}>
        <Text style={styles.heading}>Select a goal</Text>
        <Text testID="goal-selector-empty">No goals yet</Text>
      </View>
    );
  }

  return (
    <View
      testID="goal-selector"
      role="radiogroup"
      accessibilityLabel="Select a goal"
      style={styles.container}
    >
      <Text style={styles.heading}>Select a goal</Text>
      {goals.map((goal) => {
        const isSelected = goal.id === selectedGoalId;

        return (
          <Pressable
            key={goal.id}
            testID={`goal-option-${goal.id}`}
            role="radio"
            aria-checked={isSelected}
            accessibilityLabel={goal.title}
            onPress={() => {
              onSelect(goal.id);
            }}
            style={[styles.option, isSelected && styles.optionSelected]}
          >
            <Text style={isSelected ? styles.optionTextSelected : styles.optionText}>
              {goal.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  heading: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    marginBottom: 8,
  },
  optionSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  optionText: {
    fontSize: 14,
    color: '#111827',
  },
  optionTextSelected: {
    fontSize: 14,
    color: '#1d4ed8',
    fontWeight: '600',
  },
});

export { GoalSelector };
export type { GoalSelectorProps };
