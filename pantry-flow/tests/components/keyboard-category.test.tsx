import React, { useState } from 'react';
import { ScrollView, Text, TextInput } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { OptionChips } from '../../components/OptionChips';

// Real native primitives, rather than the string mocks in the legacy screen suite.
// Maestro supplies the actual open-keyboard regression on Android.
test('category selection updates the visible selection without editing the name', () => {
  function Form() {
    const [name, setName] = useState('Milk');
    const [category, setCategory] = useState('other');
    return <>
      <TextInput testID="name" value={name} onChangeText={setName} />
      <OptionChips options={['other', 'dairy']} value={category} onChange={setCategory}
        labelFor={value => value} testIDPrefix="category" />
      <Text>{`${name}: ${category}`}</Text>
    </>;
  }
  render(<Form />);
  fireEvent.changeText(screen.getByTestId('name'), 'Milk Fridge');
  fireEvent.press(screen.getByTestId('category-dairy'));
  expect(screen.getByText('Milk Fridge: dairy')).toBeTruthy();
  // Without this native ScrollView contract the first real keyboard-open tap
  // dismisses the keyboard and never reaches the chip (the confirmed defect).
  expect(screen.UNSAFE_getByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
});
