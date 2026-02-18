# Feedback tickets

Users submit feedback from the **Feedback** page (sidebar). Each submission is stored in Supabase as a ticket with a number.

## Setup

1. Run the migration in Supabase:
   - Open **Supabase Dashboard** → **SQL Editor** → New query.
   - Paste the contents of `sql/feedback_tickets.sql` and run it.

2. That creates the `feedback_tickets` table, RLS (users can submit and see only their own tickets), and a trigger so when you mark a ticket resolved, `resolved_at` is set automatically.

## Viewing tickets

- **In the app:** Logged-in users see their own tickets on the Feedback page (ticket number, subject, status, date).
- **All tickets (you):** In **Supabase Dashboard** → **Table Editor** → open the `feedback_tickets` table. You see every ticket with columns:
  - `ticket_number` – use this as the ticket # (e.g. #1, #2, #3).
  - `subject`, `message`, `user_email`, `status`, `created_at`, `resolved_at`.

## Marking a ticket resolved (“cross it out”)

1. In **Supabase Dashboard** → **Table Editor** → `feedback_tickets`.
2. Click the row (or the cell) you want to mark done.
3. Change **`status`** from `open` to `resolved` and save.
4. The trigger will set **`resolved_at`** to the current time automatically.

In the app, that ticket will show as “Resolved” and appear slightly faded in the user’s “Your tickets” list.
