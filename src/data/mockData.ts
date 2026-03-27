import { ChatRoom, Message, User } from "@/types/replychain";

const users: User[] = [
  { id: "u1", name: "Alex Chen", avatar: "AC" },
  { id: "u2", name: "Priya Sharma", avatar: "PS" },
  { id: "u3", name: "Marcus Johnson", avatar: "MJ" },
  { id: "u4", name: "Sarah Kim", avatar: "SK" },
  { id: "u5", name: "You", avatar: "YO" },
];

export const currentUser = users[4];

export const chatRooms: ChatRoom[] = [
  { id: "r1", name: "Study Group", description: "CS 301 final prep", emoji: "📚", memberCount: 12, lastActivity: new Date(Date.now() - 300000), unreadCount: 3 },
  { id: "r2", name: "Trip Planning", description: "Summer road trip", emoji: "🗺️", memberCount: 6, lastActivity: new Date(Date.now() - 900000), unreadCount: 0 },
  { id: "r3", name: "Project Alpha", description: "Startup ideas & execution", emoji: "🚀", memberCount: 8, lastActivity: new Date(Date.now() - 1800000), unreadCount: 1 },
  { id: "r4", name: "Book Club", description: "Monthly reads & discussions", emoji: "📖", memberCount: 15, lastActivity: new Date(Date.now() - 7200000), unreadCount: 0 },
  { id: "r5", name: "Fitness Squad", description: "Accountability & tips", emoji: "💪", memberCount: 9, lastActivity: new Date(Date.now() - 3600000), unreadCount: 5 },
];

export const messagesByRoom: Record<string, Message[]> = {
  r1: [
    {
      id: "m1", chatId: "r1", parentId: null, userId: "u1", user: users[0],
      content: "Has anyone started reviewing Chapter 12 on Graph Algorithms? The BFS/DFS section is really dense.",
      votesCount: 8, userVote: 0, createdAt: new Date(Date.now() - 7200000), children: [
        {
          id: "m2", chatId: "r1", parentId: "m1", userId: "u2", user: users[1],
          content: "Yes! I made some visual notes. The key insight is that BFS uses a queue while DFS uses a stack (or recursion). I can share my diagrams if anyone wants.",
          votesCount: 12, userVote: 1, createdAt: new Date(Date.now() - 6800000), children: [
            {
              id: "m3", chatId: "r1", parentId: "m2", userId: "u3", user: users[2],
              content: "Please share! I'm struggling with the time complexity analysis for adjacency list vs matrix representations.",
              votesCount: 5, userVote: 0, createdAt: new Date(Date.now() - 6400000), children: [
                {
                  id: "m4", chatId: "r1", parentId: "m3", userId: "u2", user: users[1],
                  content: "Adjacency list: O(V+E) for BFS/DFS. Matrix: O(V²). The list is almost always better for sparse graphs.",
                  votesCount: 15, userVote: 1, createdAt: new Date(Date.now() - 6000000), children: []
                }
              ]
            },
            {
              id: "m5", chatId: "r1", parentId: "m2", userId: "u4", user: users[3],
              content: "Your notes from last chapter saved me on the midterm. You're a legend 🙌",
              votesCount: 7, userVote: 0, createdAt: new Date(Date.now() - 6200000), children: []
            }
          ]
        },
        {
          id: "m6", chatId: "r1", parentId: "m1", userId: "u3", user: users[2],
          content: "I found a great YouTube playlist that walks through every algorithm with animations. Should I post it?",
          votesCount: 4, userVote: 0, createdAt: new Date(Date.now() - 5000000), children: [
            {
              id: "m7", chatId: "r1", parentId: "m6", userId: "u1", user: users[0],
              content: "Absolutely, please do! Visual learners unite 😄",
              votesCount: 3, userVote: 0, createdAt: new Date(Date.now() - 4800000), children: []
            }
          ]
        }
      ]
    },
    {
      id: "m8", chatId: "r1", parentId: null, userId: "u4", user: users[3],
      content: "Quick poll: should we do the study session Saturday 2pm or Sunday 10am? Need to book a room.",
      votesCount: 3, userVote: 0, createdAt: new Date(Date.now() - 3600000), children: [
        {
          id: "m9", chatId: "r1", parentId: "m8", userId: "u1", user: users[0],
          content: "Sunday 10am works better for me. I have a part-time shift Saturday afternoon.",
          votesCount: 2, userVote: 0, createdAt: new Date(Date.now() - 3200000), children: []
        },
        {
          id: "m10", chatId: "r1", parentId: "m8", userId: "u2", user: users[1],
          content: "Either works! But Sunday mornings are usually quieter in the library.",
          votesCount: 4, userVote: 0, createdAt: new Date(Date.now() - 3000000), children: []
        }
      ]
    }
  ],
  r2: [
    {
      id: "m20", chatId: "r2", parentId: null, userId: "u3", user: users[2],
      content: "Route update: I think we should go LA → Vegas → Grand Canyon → Sedona. 4 days, ~1200 miles total. Thoughts?",
      votesCount: 6, userVote: 0, createdAt: new Date(Date.now() - 14400000), children: [
        {
          id: "m21", chatId: "r2", parentId: "m20", userId: "u4", user: users[3],
          content: "Love it! Can we add Joshua Tree on the way to Vegas? It's only a slight detour.",
          votesCount: 9, userVote: 0, createdAt: new Date(Date.now() - 13000000), children: []
        }
      ]
    }
  ],
  r3: [
    {
      id: "m30", chatId: "r3", parentId: null, userId: "u1", user: users[0],
      content: "I've been thinking about our MVP. Should we focus on the mobile app first or build a web prototype?",
      votesCount: 5, userVote: 0, createdAt: new Date(Date.now() - 18000000), children: [
        {
          id: "m31", chatId: "r3", parentId: "m30", userId: "u2", user: users[1],
          content: "Web first — faster to iterate, and we can use it for investor demos. React + Supabase stack would be perfect.",
          votesCount: 11, userVote: 1, createdAt: new Date(Date.now() - 17000000), children: []
        }
      ]
    }
  ],
  r4: [],
  r5: [],
};
