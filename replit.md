# Overview

This is a Telegram-WhatsApp Bridge application that enables automatic message forwarding between Telegram and WhatsApp platforms. The system provides a web-based dashboard for configuration and monitoring of the bridge service, with real-time status updates and activity logging.

The application is built as a full-stack solution with a React frontend and Express.js backend, designed to handle bi-directional message synchronization between the two messaging platforms.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript in SPA mode
- **Build Tool**: Vite for development and production builds
- **UI Framework**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation via @hookform/resolvers

## Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints with JSON responses
- **Message Services**: 
  - Telegram Bot API integration via node-telegram-bot-api
  - WhatsApp Web integration via whatsapp-web.js with Puppeteer
- **Bridge Service**: Custom message queue processing with retry logic
- **Storage Layer**: Abstracted storage interface with in-memory implementation (designed for database migration)

## Data Storage
- **ORM**: Drizzle ORM configured for PostgreSQL
- **Schema Management**: Database schema defined in shared/schema.ts with automatic migrations
- **Current Implementation**: In-memory storage for development
- **Production Ready**: Neon Database serverless PostgreSQL integration configured
- **Session Management**: PostgreSQL session store via connect-pg-simple

## Core Services Design

### Bridge Service
- **Message Queue**: Persistent queue with status tracking (pending, processing, sent, failed)
- **Retry Logic**: Configurable retry attempts for failed message deliveries
- **Service Orchestration**: Coordinates between Telegram and WhatsApp services
- **Real-time Monitoring**: Live status updates and activity logging

### Telegram Integration
- **Bot Framework**: Official Telegram Bot API with polling
- **Authentication**: Bot token-based authentication
- **Message Handling**: Text message processing with configurable formatting
- **Error Recovery**: Automatic reconnection and error logging

### WhatsApp Integration  
- **Web Client**: WhatsApp Web automation via whatsapp-web.js
- **Authentication**: QR code-based session establishment
- **Session Persistence**: Local authentication strategy for session management
- **Group Targeting**: Configurable target group selection

## Configuration Management
- **Bridge Settings**: Centralized configuration for bot tokens, target groups, and message formatting
- **Runtime Updates**: Live configuration updates without service restart
- **Validation**: Zod schema validation for all configuration inputs
- **Persistence**: Database-backed configuration storage

## Development Environment
- **Hot Reload**: Vite HMR for frontend development
- **API Logging**: Request/response logging with performance metrics
- **Error Handling**: Global error boundary with user-friendly error messages
- **Development Tools**: Replit-specific tooling and development banner integration

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL for production data persistence
- **Drizzle Kit**: Database migration and schema management tools

## Messaging Platform APIs
- **Telegram Bot API**: Official API for Telegram bot integration
- **WhatsApp Web**: Browser automation for WhatsApp Web client access

## Infrastructure Services
- **Puppeteer**: Headless browser automation for WhatsApp Web interaction
- **Node Telegram Bot API**: JavaScript wrapper for Telegram Bot API

## UI Component Libraries
- **Radix UI**: Unstyled, accessible UI primitives for React
- **Shadcn/ui**: Pre-built component library based on Radix UI
- **Lucide React**: Icon library for consistent iconography
- **React QR Code**: QR code generation for WhatsApp authentication

## Development Tools
- **Replit Development Kit**: Platform-specific development tools and runtime error handling
- **Vite Plugins**: Development enhancement plugins including error overlay and cartographer

## Utility Libraries
- **Zod**: Runtime type validation and schema definition
- **Date-fns**: Date manipulation and formatting utilities
- **clsx & Tailwind Merge**: Conditional CSS class composition
- **Class Variance Authority**: Type-safe component variant management