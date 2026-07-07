PayHarness Development Blueprint

Version: 1.0

Project Overview

PayHarness is a multi-tenant Payment Orchestration Platform built as a SaaS product.

Its purpose is to allow businesses to integrate multiple payment providers through a single API and Dashboard while PayHarness manages subscriptions, credentials, routing, webhooks, security, analytics and gateway orchestration.

The platform itself is independent from merchants.

Merchants are tenants.

Merchants own payment credentials.

PayHarness owns the platform.

Vision

One SDK.

One API.

Many Payment Providers.

Examples:

M-Pesa Daraja
Stripe
PayPal
Airtel Money
Pesalink
Flutterwave
DPO
PesaPal
Cellulant
Bank APIs
Future providers

Developers install one PayHarness package.

They never integrate providers individually.

SaaS Hierarchy
PayHarness Platform
│
├── Platform Users
│
├── Subscription Plans
│
├── Merchants
│   │
│   ├── Merchant Users
│   │
│   ├── Payment Providers
│   │
│   ├── Branding
│   │
│   ├── API Keys
│   │
│   ├── Transactions
│   │
│   ├── Webhooks
│   │
│   └── Checkout
│
└── Billing
Architecture

Monorepo

payharness/

apps/
    api/
    dashboard/

packages/
    sdk/
    ui/
    shared/

Backend

NestJS
Prisma
PostgreSQL

Frontend

NextJS

Authentication

JWT

Database

PostgreSQL

Hosting

Render (Development)

Future

AWS / Azure / GCP

What Has Been Completed
Repository

Monorepo created.

Backend application established.

Dashboard application established.

Shared workspace configured.

Authentication

Merchant authentication

Registration

Login

JWT

Password hashing using bcrypt

Credential encryption

Merchant Management

Merchant model

Merchant User model

Merchant settings

Merchant branding

Merchant API Keys

Merchant subscriptions

Merchant gateways

Merchant webhooks

Subscription Foundation

Subscription Plans

Billing intervals

Monthly

Quarterly

Semi Annual

Annual

Dashboard

Merchant dashboard

Settings

Transactions

Providers

Branding

Profile

General settings

Registration

Login

Security

bcrypt password hashing

Credential encryption

JWT authentication

Encrypted provider credentials

Infrastructure

Render deployment

Neon PostgreSQL

Environment configuration

Seed support

Seeder

Subscription plans

Bootstrap support

Environment variable driven

Idempotent seed logic

Refactor Started

Platform architecture introduced.

PlatformUser model planned.

Platform authentication planned.

Merchant authentication separated.

SUPERADMIN separated from merchant ownership.

Migration strategy changed

From

prisma db push

to

prisma migrate deploy
Current Issue

Migration history was originally created using Prisma db push.

The project is now migrating to Prisma Migrations.

Current work:

Rebuilding migration history correctly.

Roles
Platform Roles

SUPERADMIN

PLATFORM_ADMIN

SUPPORT

FINANCE

COMPLIANCE

Merchant Roles

OWNER

ADMIN

DEVELOPER

VIEWER

Merchant users never become Platform users.

SUPERADMIN Responsibilities

The SUPERADMIN owns PayHarness.

Not a merchant.

Responsibilities include:

Manage all merchants

Suspend merchants

Delete merchants

Restore merchants

Manage subscriptions

Manage plans

Approve merchants

View all transactions

Manage payment providers

Manage platform settings

View platform analytics

Manage support staff

Manage finance staff

Create platform administrators

Rotate platform secrets

View audit logs

Configure feature flags

Impersonate merchants for support

Manage announcements

Manage maintenance mode

Configure platform branding

Manage billing

Manage licenses

Merchant Responsibilities

Manage business profile

Manage users

Manage branding

Manage API keys

Manage webhooks

Manage payment providers

View transactions

Manage invoices

Configure checkout

Manage SDK

Manage callbacks

Manage credentials

Payment Provider Philosophy

Each merchant owns credentials.

Examples

Merchant A

Stripe Account

Stripe Secret

Stripe Publishable Key

M-Pesa Till

Paybill

Consumer Key

Consumer Secret

Passkey

PayPal

Client ID

Secret

Environment

Merchant B has completely different credentials.

PayHarness never hardcodes provider credentials.

Planned Payment Providers

M-Pesa

Stripe

PayPal

Flutterwave

Pesapal

Cellulant

DPO

Pesalink

Bank APIs

Manual Payments

Future Plugins

Gateway Philosophy

One merchant

↓

Multiple providers

↓

Multiple accounts

Example

Merchant

↓

M-Pesa

Till 1

Till 2

Paybill

↓

Stripe

Production

Sandbox

↓

PayPal

Primary

Backup

Routing engine determines which gateway processes payments.

Coding Standards

Always use:

Repository Pattern

Service Layer

Dependency Injection

DTO validation

Class Validators

Enums

Strict TypeScript

No duplicated logic

Reusable components

Reusable services

No hardcoded secrets

Environment driven configuration

Naming Standards

Singular model names

PascalCase

camelCase variables

UPPER_CASE env variables

REST endpoints

Plural resources

Examples

/merchants

/providers

/subscriptions

/plans
Security Standards

Passwords hashed

Credentials encrypted

JWT expiry configurable

Never log secrets

Never expose provider credentials

Secrets only decrypted server-side

Audit every sensitive action

API Standards

REST first

Versioned APIs

/api/v1/

Consistent responses

success

message

data

meta
Database Standards

Use Prisma migrations

Never use db push in production

Every schema change requires migration

Every migration must be tested on an empty database

Git Standards

Small commits

Meaningful commit messages

Feature branches

Merge after build passes

Documentation Standards

Every module requires:

README

Architecture notes

Environment variables

API documentation

Development Roadmap
Phase 1

Foundation

✅ Complete

Phase 2

Merchant Dashboard

✅ Complete

Phase 3

Authentication

✅ Complete

Phase 4

Platform Separation

🚧 In Progress

Platform Users

Platform Authentication

Platform Dashboard

Platform Roles

Migration Refactor

Phase 5

Merchant Management

Platform can:

Create merchants

Suspend merchants

Delete merchants

Archive merchants

Restore merchants

Impersonate merchants

Audit merchants

Phase 6

Subscription Engine

Plans

Billing

Trials

Renewals

Invoices

Grace Periods

Usage Limits

Feature Flags

Phase 7

Payment Provider Registry

Platform-managed provider catalog

Enable/disable providers

Version providers

Provider metadata

Provider health checks

Phase 8

Merchant Gateway Management

Multiple M-Pesa accounts

Multiple Stripe accounts

Multiple PayPal accounts

Gateway priorities

Default gateways

Automatic failover

Credential validation

Connection testing

Phase 9

Payment Orchestration

Unified payment API

Gateway routing

Fallback routing

Retry logic

Idempotency

Currency routing

Webhook processing

Settlement tracking

Phase 10

Developer Experience

Official SDKs

Node.js

PHP

Python

Laravel

React

Next.js

Documentation portal

Postman collection

CLI

Phase 11

Enterprise Features

Audit logs

Monitoring

Analytics

Reports

RBAC

Organization support

White-label support

Usage metering

API rate limiting

Definition of Done (DoD)

A feature is considered complete only if it:

Compiles without TypeScript errors.
Passes linting.
Includes Prisma migration (if applicable).
Includes DTO validation.
Includes unit tests where appropriate.
Includes API documentation updates.
Includes dashboard UI if user-facing.
Is idempotent where required (e.g., seeders).
Follows repository, service, and controller separation.
Does not introduce hardcoded secrets or credentials.
Maintains backward compatibility unless a documented breaking change is intentional.
Project Goal

Build the leading African payment orchestration platform that allows any developer to integrate once and accept payments through multiple providers, while providing merchants with a secure, scalable, subscription-based platform for managing payments, gateways, and business operations.