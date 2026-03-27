

## Issues & Fixes

### Problem 1: Messages not displaying
The message query uses `profiles!messages_user_id_fkey` but there is **no foreign key** from `messages.user_id` to `profiles`. The FK points to `auth.users`, not `profiles`. This causes the join to fail silently, returning no data.

**Fix**: Change the query to join profiles via `user_id` matching instead of a named FK. Use a two-step approach: fetch messages, then fetch profiles separately and merge them client-side. Alternatively, add a proper FK from `messages.user_id` to `profiles.user_id`.

### Problem 2: Profile trigger may not exist
The trigger `on_auth_user_created` attaches to `auth.users` (reserved schema). The system reports "no triggers in the database." Need to re-create the trigger or add fallback profile creation in the auth context.

### Problem 3: No room join request system
Currently any authenticated user sees all rooms and can post. Need a `room_join_requests` table with `pending/approved/rejected` status, and UI for requesting access and approving requests.

### Problem 4: Emoji in room names
Remove emoji display from `RoomSidebar`, `ChatView` header, and `MobileNav`.

---

## Implementation Plan

### Step 1: Database Migration
- Add FK from `messages.user_id` to `profiles.user_id` (so the Supabase join works)
- Create `room_join_requests` table with columns: `id`, `room_id`, `user_id`, `status` (pending/approved/rejected), `created_at`
- Add RLS policies: users can insert their own requests, room creators can update status, authenticated can read
- Re-create the `on_auth_user_created` trigger on `auth.users`
- Add UPDATE policy on `messages` for `votes_count` updates

### Step 2: Fix Message Fetching (Index.tsx)
- Update the profiles join query to use the new FK relationship
- Add fallback profile creation in `AuthContext` if profile doesn't exist after login

### Step 3: Remove Emoji from UI
- **RoomSidebar.tsx**: Remove `<span>{room.emoji}</span>` from room list items, use a generic icon instead
- **ChatView.tsx**: Remove `<span>{room.emoji}</span>` from room header
- **MobileNav.tsx**: Remove emoji from room list
- **RoomSidebar.tsx**: Stop generating random emoji in `handleCreate`

### Step 4: Add Room Join Request System
- **Index.tsx**: 
  - Add `joinRequests` state, fetch pending requests
  - Only show messages if user is a member of the room
  - Add `handleRequestJoin` and `handleApproveRequest` functions
- **RoomSidebar.tsx**: Show "Request to Join" button for rooms user hasn't joined; show pending status
- **ChatView.tsx**: Show "You need to join this room" message for non-members with a request button
- New component or inline UI for room creators to see and approve/reject pending requests

### Technical Details
- The profiles FK will reference `profiles(user_id)` with a named constraint like `messages_user_id_profiles_fkey`
- Join query becomes: `profiles!messages_user_id_profiles_fkey(display_name, username, avatar_url)`
- Room join flow: User sees room → clicks "Request to Join" → creator sees notification → approves → user becomes member and can post/view threads

