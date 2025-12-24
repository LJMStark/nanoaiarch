import { boolean, integer, pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').notNull(),
	image: text('image'),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull(),
	role: text('role'),
	banned: boolean('banned'),
	banReason: text('ban_reason'),
	banExpires: timestamp('ban_expires'),
	customerId: text('customer_id'),
	// Referral fields
	referralCode: text('referral_code').unique(),
	referredBy: text('referred_by'),
}, (table) => ({
	userIdIdx: index("user_id_idx").on(table.id),
	userCustomerIdIdx: index("user_customer_id_idx").on(table.customerId),
	userRoleIdx: index("user_role_idx").on(table.role),
	userReferralCodeIdx: index("user_referral_code_idx").on(table.referralCode),
}));

export const session = pgTable("session", {
	id: text("id").primaryKey(),
	expiresAt: timestamp('expires_at').notNull(),
	token: text('token').notNull().unique(),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	impersonatedBy: text('impersonated_by')
}, (table) => ({
	sessionTokenIdx: index("session_token_idx").on(table.token),
	sessionUserIdIdx: index("session_user_id_idx").on(table.userId),
}));

export const account = pgTable("account", {
	id: text("id").primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: timestamp('access_token_expires_at'),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
	scope: text('scope'),
	password: text('password'),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull()
}, (table) => ({
	accountUserIdIdx: index("account_user_id_idx").on(table.userId),
	accountAccountIdIdx: index("account_account_id_idx").on(table.accountId),
	accountProviderIdIdx: index("account_provider_id_idx").on(table.providerId),
}));

export const verification = pgTable("verification", {
	id: text("id").primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at')
});

export const payment = pgTable("payment", {
	id: text("id").primaryKey(),
	priceId: text('price_id').notNull(),
	type: text('type').notNull(),
	scene: text('scene'), // payment scene: 'lifetime', 'credit', 'subscription'
	interval: text('interval'),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	customerId: text('customer_id').notNull(),
	subscriptionId: text('subscription_id'),
	sessionId: text('session_id'),
	invoiceId: text('invoice_id').unique(), // unique constraint for avoiding duplicate processing
	status: text('status').notNull(),
	paid: boolean('paid').notNull().default(false), // indicates whether payment is completed (set in invoice.paid event)
	periodStart: timestamp('period_start'),
	periodEnd: timestamp('period_end'),
	cancelAtPeriodEnd: boolean('cancel_at_period_end'),
	trialStart: timestamp('trial_start'),
	trialEnd: timestamp('trial_end'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
	paymentTypeIdx: index("payment_type_idx").on(table.type),
	paymentSceneIdx: index("payment_scene_idx").on(table.scene),
	paymentPriceIdIdx: index("payment_price_id_idx").on(table.priceId),
	paymentUserIdIdx: index("payment_user_id_idx").on(table.userId),
	paymentCustomerIdIdx: index("payment_customer_id_idx").on(table.customerId),
	paymentStatusIdx: index("payment_status_idx").on(table.status),
	paymentPaidIdx: index("payment_paid_idx").on(table.paid),
	paymentSubscriptionIdIdx: index("payment_subscription_id_idx").on(table.subscriptionId),
	paymentSessionIdIdx: index("payment_session_id_idx").on(table.sessionId),
	paymentInvoiceIdIdx: index("payment_invoice_id_idx").on(table.invoiceId),
}));

export const userCredit = pgTable("user_credit", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
	currentCredits: integer("current_credits").notNull().default(0),
	lastRefreshAt: timestamp("last_refresh_at"), // deprecated
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
	userCreditUserIdIdx: index("user_credit_user_id_idx").on(table.userId),
}));

export const creditTransaction = pgTable("credit_transaction", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
	type: text("type").notNull(),
	description: text("description"),
	amount: integer("amount").notNull(),
	remainingAmount: integer("remaining_amount"),
	paymentId: text("payment_id"), // field name is paymentId, but actually it's invoiceId
	expirationDate: timestamp("expiration_date"),
	expirationDateProcessedAt: timestamp("expiration_date_processed_at"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
	creditTransactionUserIdIdx: index("credit_transaction_user_id_idx").on(table.userId),
	creditTransactionTypeIdx: index("credit_transaction_type_idx").on(table.type),
}));

// Generation history table for storing user's AI generation records
export const generationHistory = pgTable("generation_history", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
	templateId: text("template_id"), // which template was used
	templateName: text("template_name"), // template name for display
	prompt: text("prompt").notNull(), // user's prompt
	enhancedPrompt: text("enhanced_prompt"), // AI-enhanced prompt
	style: text("style"), // style preset used
	aspectRatio: text("aspect_ratio"), // aspect ratio used
	model: text("model"), // AI model used
	imageUrl: text("image_url"), // generated image URL
	referenceImageUrl: text("reference_image_url"), // reference image if used
	creditsUsed: integer("credits_used").notNull().default(1),
	status: text("status").notNull().default("completed"), // pending, completed, failed
	errorMessage: text("error_message"), // error message if failed
	isFavorite: boolean("is_favorite").notNull().default(false),
	isPublic: boolean("is_public").notNull().default(false), // for future gallery feature
	metadata: text("metadata"), // JSON string for additional data
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
	generationHistoryUserIdIdx: index("generation_history_user_id_idx").on(table.userId),
	generationHistoryTemplateIdIdx: index("generation_history_template_id_idx").on(table.templateId),
	generationHistoryStatusIdx: index("generation_history_status_idx").on(table.status),
	generationHistoryIsFavoriteIdx: index("generation_history_is_favorite_idx").on(table.isFavorite),
	generationHistoryIsPublicIdx: index("generation_history_is_public_idx").on(table.isPublic),
	generationHistoryCreatedAtIdx: index("generation_history_created_at_idx").on(table.createdAt),
}));

// Referral tracking table
export const referral = pgTable("referral", {
	id: text("id").primaryKey(),
	referrerId: text("referrer_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
	referredId: text("referred_id").notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
	status: text("status").notNull().default("pending"), // pending, qualified, rewarded
	qualifiedAt: timestamp("qualified_at"), // when referred user made first payment
	rewardedAt: timestamp("rewarded_at"), // when referrer received commission
	createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
	referralReferrerIdIdx: index("referral_referrer_id_idx").on(table.referrerId),
	referralStatusIdx: index("referral_status_idx").on(table.status),
}));
