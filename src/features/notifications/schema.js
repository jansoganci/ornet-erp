import { z } from 'zod';

export const reminderSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().max(500).optional().or(z.literal('')),
  remind_date: z.string().min(1),
  remind_time: z.string().optional(),
});

export const reminderDefaultValues = {
  title: '',
  content: '',
  remind_date: '',
  remind_time: '',
};
