import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockAddItem = jest.fn();
jest.mock('@/hooks/useShoppingItems', () => ({
  useShoppingItems: () => ({
    householdId: 'h', items: [], loading: false, error: null, retry: jest.fn(), addItem: mockAddItem,
  }),
}));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import ShoppingScreen from '../../app/(tabs)/shopping';

// Real TextInput, Input and Button: proves the wiring with real primitives. It does not
// establish real Android keyboard behaviour (Maestro covers that).
test('typing a name and pressing Add submits it and clears the field', async () => {
  mockAddItem.mockResolvedValue({ id: 'm' });
  await render(<ShoppingScreen />);
  await fireEvent.changeText(screen.getByTestId('shopping-add-input'), 'Milk');
  await fireEvent.press(screen.getByTestId('shopping-add-submit'));
  expect(mockAddItem).toHaveBeenCalledWith({ name: 'Milk' });
  expect(screen.getByTestId('shopping-add-input').props.value).toBe('');
});
