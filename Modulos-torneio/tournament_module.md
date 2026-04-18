# 🏀 Tournament Module --- Basketball

## Software Requirements Document (AI-Optimized)

**Version:** 1.0\
**Date:** 2026-04-16\
**Project:** Sports Management System --- Basketball\
**Module:** Tournaments\
**Status:** In Review

------------------------------------------------------------------------

## 1. Overview

The Tournament Module extends the existing system (currently focused on
informal matches like pickup games) into a structured competitive
environment.

It must: - Operate within the **Admin Panel** - Reuse the **existing
match system** - Add a **formal competition layer**

### Core Principle

Do NOT replace the current match system. Extend it with structured
tournament logic.

------------------------------------------------------------------------

## 2. Objectives

The system must enable:

-   Tournament creation and configuration
-   Team registration and management
-   Rule customization per modality
-   Automatic match generation (brackets/rounds)
-   Real-time match tracking
-   Public tournament visualization

------------------------------------------------------------------------

## 3. Scope

### In Scope

-   Tournament creation (Admin)
-   Team registration (free and paid)
-   Team editor (players + staff)
-   Match formats:
    -   Round-robin
    -   Knockout
    -   Group stage
    -   Cross groups
-   Integration with match engine
-   Public tournament page

### Out of Scope (v1.0)

-   Possession timer
-   Native mobile app
-   Live streaming
-   Payment gateway integration (mock allowed)

------------------------------------------------------------------------

## 4. Roles & Permissions

Admin: - Create/edit tournaments - Configure rules - Manage teams -
Generate brackets - Publish tournament

User (Captain): - Register team - Manage roster

Public: - View tournament (no auth)

------------------------------------------------------------------------

## 5. Tournament Creation

interface Tournament { id: string name: string modality: "1x1" \| "3x3"
\| "5x5" gender: "MALE" \| "FEMALE" startDate: Date endDate?: Date
locationId: string type: "FREE" \| "PAID" price?: number
rulesDocumentUrl?: string description?: string registrationLink: string
}

------------------------------------------------------------------------

## 6. Rules Engine

const defaultRules = { "1x1": { winCondition: 11, points: \[1\],
playersOnCourt: 1, maxRoster: 1 }, "3x3": { gameTime: 10, winCondition:
21, points: \[1,2\], playersOnCourt: 3, maxRoster: 6 }, "5x5": {
gameTime: "4x10", points: \[2,3\], playersOnCourt: 5, maxRoster: 15 } }

------------------------------------------------------------------------

## 7. Team Registration Flow

Admin creates tournament → System generates link → User accesses link →
Payment (if required) → Team Editor → Submit team

------------------------------------------------------------------------

## 8. Team Editor

interface Team { id: string name: string logoUrl: string coach: string
trainer?: string staff?: string\[\] players: Player\[\] }

interface Player { id: string name: string number: number position: "PG"
\| "SG" \| "SF" \| "PF" \| "C" isStarter: boolean }

------------------------------------------------------------------------

## 9. Match Formats

"ROUND_ROBIN" \| "KNOCKOUT" \| "GROUP_STAGE" \| "CROSS_GROUPS"

------------------------------------------------------------------------

## 10. Rounds Logic

Remove highlight card if: - New round created - At least one winner
exists

------------------------------------------------------------------------

## 11. Public Tournament Page

/events/:tournamentId

Sections: - Info - Teams - Matches - Standings - Results - Bracket

------------------------------------------------------------------------

## 12. Acceptance Criteria

-   Tournament creation \< 5 minutes
-   Registration link works
-   Bracket updates automatically
-   Limits enforced

------------------------------------------------------------------------

## Implementation Notes

-   Reuse match system
-   Separate tournament logic
-   API-first

------------------------------------------------------------------------

## Suggested Architecture

/modules/tournaments/
