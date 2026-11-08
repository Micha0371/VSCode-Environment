import React, { useState } from 'react';
import { Text, TextInput } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { OptionChips } from '../../components/OptionChips';

// Real native primitives, rather than the string mocks in the legacy screen suite.
// Maestro supplies the actual open-keyboard regression on Android.
test('category selection updates the visible selection without editing the name', async () => {
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
  await render(<Form />);
  await fireEvent.changeText(screen.getByTestId('name'), 'Milk Fridge');
  await fireEvent.press(screen.getByTestId('category-dairy'));
  expect(screen.getByText('Milk Fridge: dairy')).toBeTruthy();
  // RNTL 14 exposes host elements only. The unchanged ScrollView tap contract is
  // retained in keyboard-contract.test.cjs; Maestro verifies the real keyboard.
});
