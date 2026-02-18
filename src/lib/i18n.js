import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Import all translation files
import commonTr from '../locales/tr/common.json'
import authTr from '../locales/tr/auth.json'
import errorsTr from '../locales/tr/errors.json'
import customersTr from '../locales/tr/customers.json'
import workOrdersTr from '../locales/tr/workOrders.json'
import dailyWorkTr from '../locales/tr/dailyWork.json'
import workHistoryTr from '../locales/tr/workHistory.json'
import materialsTr from '../locales/tr/materials.json'
import tasksTr from '../locales/tr/tasks.json'
import dashboardTr from '../locales/tr/dashboard.json'
import profileTr from '../locales/tr/profile.json'
import calendarTr from '../locales/tr/calendar.json'
import subscriptionsTr from '../locales/tr/subscriptions.json'
import simCardsTr from '../locales/tr/simCards.json'
import proposalsTr from '../locales/tr/proposals.json'
import financeTr from '../locales/tr/finance.json'
import notificationsTr from '../locales/tr/notifications.json'
import recurringTr from '../locales/tr/recurring.json'
import siteAssetsTr from '../locales/tr/siteAssets.json'

i18n.use(initReactI18next).init({
  lng: 'tr',
  fallbackLng: 'tr',
  defaultNS: 'common',
  ns: [
    'common',
    'auth',
    'errors',
    'customers',
    'workOrders',
    'dailyWork',
    'workHistory',
    'materials',
    'tasks',
    'dashboard',
    'profile',
    'calendar',
    'subscriptions',
    'simCards',
    'proposals',
    'finance',
    'notifications',
    'recurring',
    'siteAssets',
  ],
  resources: {
    tr: {
      common: commonTr,
      auth: authTr,
      errors: errorsTr,
      customers: customersTr,
      workOrders: workOrdersTr,
      dailyWork: dailyWorkTr,
      workHistory: workHistoryTr,
      materials: materialsTr,
      tasks: tasksTr,
      dashboard: dashboardTr,
      profile: profileTr,
      calendar: calendarTr,
      subscriptions: subscriptionsTr,
      simCards: simCardsTr,
      proposals: proposalsTr,
      finance: financeTr,
      notifications: notificationsTr,
      recurring: recurringTr,
      siteAssets: siteAssetsTr,
    },
  },
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
