/* eslint-disable react-refresh/only-export-components -- provider and its consumer hook form one public context API */
import React, { createContext, useContext } from 'react';
import { useRecurringIncomeStore } from '../hooks/useRecurringIncome';

const RecurringIncomeContext = createContext(null);

export function RecurringIncomeProvider({ children }) {
  const value = useRecurringIncomeStore();
  return React.createElement(RecurringIncomeContext.Provider, { value }, children);
}

export function useRecurringIncomeContext() {
  const context = useContext(RecurringIncomeContext);
  if (!context) throw new Error('RecurringIncomeProvider manquant');
  return context;
}
