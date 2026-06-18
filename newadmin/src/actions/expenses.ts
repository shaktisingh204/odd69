'use server';

/**
 * Expenses Management — Server Actions
 * Handles: Expenses, Investments, Fund Flows, Budgets, Analytics
 * Storage: MongoDB via Mongoose (no Prisma schema change needed)
 */

import connectMongo from '@/lib/mongo';
import mongoose, { Schema, Document, Model } from 'mongoose';
import { revalidatePath } from 'next/cache';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExpenseCategory = string;

export interface CustomField {
    name: string;
    label: string;
    type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT';
    options?: string[];
    required: boolean;
}

export interface ExpenseCategoryDoc {
    _id: string;
    slug: string;
    name: string;
    customFields: CustomField[];
    createdAt: Date | string;
    updatedAt: Date | string;
}

export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
export type FundFlowType = 'INFLOW' | 'OUTFLOW' | 'TRANSFER';
export type InvestmentStatus = 'ACTIVE' | 'MATURED' | 'WITHDRAWN' | 'PENDING';
export type RecurrenceType = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface ExpenseDoc {
    _id: string;
    title: string;
    description?: string;
    amount: number;
    currency: string;
    category: ExpenseCategory;
    status: ExpenseStatus;
    vendor?: string;
    invoiceRef?: string;
    receiptUrl?: string;
    paymentMethod?: string;
    approvedBy?: string;
    approvedAt?: Date | string;
    paidAt?: Date | string;
    recurrence: RecurrenceType;
    tags: string[];
    notes?: string;
    customData?: Record<string, any>;
    createdBy: string;
    createdAt: Date | string;
    updatedAt: Date | string;
}

export interface FundFlowDoc {
    _id: string;
    type: FundFlowType;
    title: string;
    description?: string;
    amount: number;
    currency: string;
    source?: string;
    destination?: string;
    referenceId?: string;
    category: string;
    attachmentUrl?: string;
    linkedExpenseId?: string;
    createdBy: string;
    createdAt: Date | string;
    updatedAt: Date | string;
}

export interface InvestmentDoc {
    _id: string;
    title: string;
    description?: string;
    principal: number;
    currentValue: number;
    currency: string;
    returnRate?: number;
    platform?: string;
    investedAt: Date | string;
    maturesAt?: Date | string;
    status: InvestmentStatus;
    category: string;
    notes?: string;
    createdBy: string;
    createdAt: Date | string;
    updatedAt: Date | string;
}

export interface BudgetDoc {
    _id: string;
    category: ExpenseCategory;
    limit: number;
    spent: number;
    currency: string;
    period: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    periodLabel: string; // e.g. "2026-03"
    alerts: boolean;
    alertThreshold: number; // 0-100 percent
    createdAt: Date | string;
    updatedAt: Date | string;
}

export interface UpiAccountDoc {
    _id: string;
    name: string;
    upiId: string;
    type: 'MANUAL' | 'GATEWAY';
    providerName?: string;
    status: 'ACTIVE' | 'MAINTENANCE' | 'DISABLED';
    limitAmount?: number;
    feePercent?: number;
    totalDeposits: number;
    totalWithdrawals: number;
    currentBalance: number;
    createdAt: Date | string;
    updatedAt: Date | string;
}

// ─── Mongoose Schemas ─────────────────────────────────────────────────────────

interface ExpenseDocument extends Document {
    title: string;
    description?: string;
    amount: number;
    currency: string;
    category: ExpenseCategory;
    status: ExpenseStatus;
    vendor?: string;
    invoiceRef?: string;
    receiptUrl?: string;
    paymentMethod?: string;
    approvedBy?: string;
    approvedAt?: Date;
    paidAt?: Date;
    recurrence: RecurrenceType;
    tags: string[];
    notes?: string;
    customData?: Record<string, any>;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

interface FundFlowDocument extends Document {
    type: FundFlowType;
    title: string;
    description?: string;
    amount: number;
    currency: string;
    source?: string;
    destination?: string;
    referenceId?: string;
    category: string;
    attachmentUrl?: string;
    linkedExpenseId?: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

interface InvestmentDocument extends Document {
    title: string;
    description?: string;
    principal: number;
    currentValue: number;
    currency: string;
    returnRate?: number;
    platform?: string;
    investedAt: Date;
    maturesAt?: Date;
    status: InvestmentStatus;
    category: string;
    notes?: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

interface BudgetDocument extends Document {
    category: ExpenseCategory;
    limit: number;
    spent: number;
    currency: string;
    period: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    periodLabel: string;
    alerts: boolean;
    alertThreshold: number;
    createdAt: Date;
    updatedAt: Date;
}

interface AdminUpiAccountDocument extends Document {
    name: string;
    upiId: string;
    type: 'MANUAL' | 'GATEWAY';
    providerName?: string;
    status: 'ACTIVE' | 'MAINTENANCE' | 'DISABLED';
    limitAmount?: number;
    feePercent?: number;
    totalDeposits: number;
    totalWithdrawals: number;
    currentBalance: number;
    createdAt: Date;
    updatedAt: Date;
}

// ─── Model Getters (lazy singleton — avoids Next.js re-register errors) ───────

interface ExpenseCategoryDocument extends Document {
    slug: string;
    name: string;
    customFields: CustomField[];
    createdAt: Date;
    updatedAt: Date;
}

function getExpenseCategoryModel(): Model<ExpenseCategoryDocument> {
    if (mongoose.models.AdminExpenseCategory) {
        return mongoose.models.AdminExpenseCategory as Model<ExpenseCategoryDocument>;
    }
    const schema = new Schema<ExpenseCategoryDocument>(
        {
            slug: { type: String, required: true, unique: true },
            name: { type: String, required: true },
            customFields: { type: Schema.Types.Mixed, default: [] },
        },
        { timestamps: true }
    );
    return mongoose.model<ExpenseCategoryDocument>('AdminExpenseCategory', schema);
}

function getUpiAccountModel(): Model<AdminUpiAccountDocument> {
    if (mongoose.models.AdminUpiAccount) {
        return mongoose.models.AdminUpiAccount as Model<AdminUpiAccountDocument>;
    }
    const schema = new Schema<AdminUpiAccountDocument>(
        {
            name: { type: String, required: true },
            upiId: { type: String, required: true, unique: true },
            type: { type: String, enum: ['MANUAL', 'GATEWAY'], required: true },
            providerName: { type: String },
            status: { type: String, enum: ['ACTIVE', 'MAINTENANCE', 'DISABLED'], default: 'ACTIVE' },
            limitAmount: { type: Number, default: 0 },
            feePercent: { type: Number, default: 0 },
            totalDeposits: { type: Number, default: 0 },
            totalWithdrawals: { type: Number, default: 0 },
            currentBalance: { type: Number, default: 0 },
        },
        { timestamps: true }
    );
    return mongoose.model<AdminUpiAccountDocument>('AdminUpiAccount', schema);
}

function getExpenseModel(): Model<ExpenseDocument> {
    if (mongoose.models.AdminExpense) {
        return mongoose.models.AdminExpense as Model<ExpenseDocument>;
    }
    const schema = new Schema<ExpenseDocument>(
        {
            title: { type: String, required: true },
            description: String,
            amount: { type: Number, required: true },
            currency: { type: String, default: 'INR' },
            category: { type: String, required: true },
            status: {
                type: String,
                enum: ['PENDING', 'APPROVED', 'REJECTED', 'PAID'],
                default: 'PENDING',
            },
            vendor: String,
            invoiceRef: String,
            receiptUrl: String,
            paymentMethod: String,
            approvedBy: String,
            approvedAt: Date,
            paidAt: Date,
            recurrence: {
                type: String,
                enum: ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'],
                default: 'NONE',
            },
            tags: [String],
            notes: String,
            customData: { type: Schema.Types.Mixed, default: {} },
            createdBy: { type: String, required: true },
        },
        { timestamps: true }
    );
    return mongoose.model<ExpenseDocument>('AdminExpense', schema);
}

function getFundFlowModel(): Model<FundFlowDocument> {
    if (mongoose.models.AdminFundFlow) {
        return mongoose.models.AdminFundFlow as Model<FundFlowDocument>;
    }
    const schema = new Schema<FundFlowDocument>(
        {
            type: { type: String, enum: ['INFLOW', 'OUTFLOW', 'TRANSFER'], required: true },
            title: { type: String, required: true },
            description: String,
            amount: { type: Number, required: true },
            currency: { type: String, default: 'INR' },
            source: String,
            destination: String,
            referenceId: String,
            category: { type: String, default: 'GENERAL' },
            attachmentUrl: String,
            linkedExpenseId: String,
            createdBy: { type: String, required: true },
        },
        { timestamps: true }
    );
    return mongoose.model<FundFlowDocument>('AdminFundFlow', schema);
}

function getInvestmentModel(): Model<InvestmentDocument> {
    if (mongoose.models.AdminInvestment) {
        return mongoose.models.AdminInvestment as Model<InvestmentDocument>;
    }
    const schema = new Schema<InvestmentDocument>(
        {
            title: { type: String, required: true },
            description: String,
            principal: { type: Number, required: true },
            currentValue: { type: Number, required: true },
            currency: { type: String, default: 'INR' },
            returnRate: Number,
            platform: String,
            investedAt: { type: Date, required: true },
            maturesAt: Date,
            status: {
                type: String,
                enum: ['ACTIVE', 'MATURED', 'WITHDRAWN', 'PENDING'],
                default: 'ACTIVE',
            },
            category: { type: String, default: 'GENERAL' },
            notes: String,
            createdBy: { type: String, required: true },
        },
        { timestamps: true }
    );
    return mongoose.model<InvestmentDocument>('AdminInvestment', schema);
}

function getBudgetModel(): Model<BudgetDocument> {
    if (mongoose.models.AdminBudget) {
        return mongoose.models.AdminBudget as Model<BudgetDocument>;
    }
    const schema = new Schema<BudgetDocument>(
        {
            category: { type: String, required: true },
            limit: { type: Number, required: true },
            spent: { type: Number, default: 0 },
            currency: { type: String, default: 'INR' },
            period: { type: String, enum: ['MONTHLY', 'QUARTERLY', 'YEARLY'], default: 'MONTHLY' },
            periodLabel: { type: String, required: true },
            alerts: { type: Boolean, default: true },
            alertThreshold: { type: Number, default: 80 },
        },
        { timestamps: true }
    );
    return mongoose.model<BudgetDocument>('AdminBudget', schema);
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function toPlain<T>(doc: unknown): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = (doc as any).toObject ? (doc as any).toObject() : doc;
    return JSON.parse(JSON.stringify(obj)) as T;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPENSES
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// EXPENSE CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

export async function getExpenseCategories() {
    await connectMongo();
    const CatModel = getExpenseCategoryModel();
    const docs = await CatModel.find({}).sort({ name: 1 }).lean();
    
    // Auto-seed if exactly zero categories found
    if (docs.length === 0) {
        const defaults = [
            { slug: 'OPERATIONAL', name: 'Operational', customFields: [] },
            { slug: 'MARKETING', name: 'Marketing', customFields: [] },
            { slug: 'TECHNOLOGY', name: 'Technology', customFields: [] },
            { slug: 'SALARY', name: 'Salary', customFields: [] },
            { slug: 'INFRASTRUCTURE', name: 'Infrastructure', customFields: [] },
            { slug: 'LEGAL', name: 'Legal', customFields: [] },
            { slug: 'MISCELLANEOUS', name: 'Miscellaneous', customFields: [] }
        ];
        await CatModel.insertMany(defaults);
        const newDocs = await CatModel.find({}).sort({ name: 1 }).lean();
        return newDocs.map((d: any) => toPlain<ExpenseCategoryDoc>(d));
    }
    return docs.map((d: any) => toPlain<ExpenseCategoryDoc>(d));
}

export async function upsertExpenseCategory(data: {
    slug: string;
    name: string;
    customFields: CustomField[];
}) {
    try {
        await connectMongo();
        const CatModel = getExpenseCategoryModel();
        await CatModel.findOneAndUpdate(
            { slug: data.slug },
            { $set: { name: data.name, customFields: data.customFields } },
            { upsert: true, returnDocument: 'after' }
        );
        revalidatePath('/dashboard/expenses');
        return { success: true };
    } catch (err) {
        console.error('upsertExpenseCat error:', err);
        return { success: false, error: 'Failed to update category tracking parameters' };
    }
}

export async function deployExpenseTemplates() {
    try {
        await connectMongo();
        const Model = getExpenseCategoryModel();

        const templates = [
            {
                slug: "BANK_ACCOUNTS",
                name: "Bank Account Purchases",
                customFields: [
                    { name: "acct_owner", label: "Account Owner Name", type: "TEXT", required: true },
                    { name: "bank_name", label: "Bank Name", type: "TEXT", required: true },
                    { name: "acct_no", label: "Account Number", type: "TEXT", required: true },
                    { name: "ifsc", label: "IFSC Code", type: "TEXT", required: true },
                    { name: "upi_id", label: "UPI ID Attached", type: "TEXT", required: false }
                ]
            },
            {
                slug: "AD_SPENDS",
                name: "Advertising Spends",
                customFields: [
                    { name: "campaign_name", label: "Campaign Name", type: "TEXT", required: true },
                    { name: "platform", label: "Ad Platform", type: "SELECT", options: ["Facebook", "Instagram", "Google Ads", "Telegram Promo", "Offline"], required: true },
                    { name: "leads", label: "Estimated Leads/Views", type: "NUMBER", required: false }
                ]
            }
        ];

        for (const t of templates) {
            await Model.findOneAndUpdate({ slug: t.slug }, t, { upsert: true });
        }
        return { success: true };
    } catch (e) {
        return { success: false };
    }
}

export async function deleteExpenseCategory(slug: string) {
    try {
        await connectMongo();
        const CatModel = getExpenseCategoryModel();
        await CatModel.findOneAndDelete({ slug });
        revalidatePath('/dashboard/expenses');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: 'Failed to delete' };
    }
}

export async function getExpenses(
    page = 1,
    limit = 20,
    search = '',
    category = '',
    status = '',
    dateFrom = '',
    dateTo = '',
) {
    await connectMongo();
    const Expense = getExpenseModel();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};
    if (search) {
        filter.$or = [
            { title: { $regex: search, $options: 'i' } },
            { vendor: { $regex: search, $options: 'i' } },
            { invoiceRef: { $regex: search, $options: 'i' } },
        ];
    }
    if (category && category !== 'ALL') filter.category = category;
    if (status && status !== 'ALL') filter.status = status;
    if (dateFrom || dateTo) {
        filter.createdAt = {};
        if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
        if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
        Expense.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Expense.countDocuments(filter),
    ]);

    return {
        expenses: docs.map(d => toPlain<ExpenseDoc>(d)),
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
}

export async function getExpenseSummary() {
    await connectMongo();
    const Expense = getExpenseModel();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [
        totalAll,
        totalMonth,
        totalYear,
        byCategory,
        byStatus,
        recentPending,
    ] = await Promise.all([
        Expense.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
        Expense.aggregate([
            { $match: { createdAt: { $gte: startOfMonth }, status: { $in: ['APPROVED', 'PAID'] } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        Expense.aggregate([
            { $match: { createdAt: { $gte: startOfYear }, status: { $in: ['APPROVED', 'PAID'] } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        Expense.aggregate([
            { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
            { $sort: { total: -1 } },
        ]),
        Expense.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        Expense.countDocuments({ status: 'PENDING' }),
    ]);

    return {
        totalAll: totalAll[0]?.total ?? 0,
        totalMonth: totalMonth[0]?.total ?? 0,
        totalYear: totalYear[0]?.total ?? 0,
        byCategory: byCategory as { _id: string; total: number; count: number }[],
        byStatus: byStatus as { _id: string; count: number }[],
        recentPending,
    };
}

export async function createExpense(data: {
    title: string;
    description?: string;
    amount: number;
    currency?: string;
    category: ExpenseCategory;
    vendor?: string;
    invoiceRef?: string;
    paymentMethod?: string;
    recurrence?: RecurrenceType;
    tags?: string[];
    notes?: string;
    customData?: Record<string, any>;
    createdBy: string;
}) {
    try {
        await connectMongo();
        const Expense = getExpenseModel();
        const doc = await Expense.create({
            ...data,
            currency: data.currency || 'INR',
            recurrence: data.recurrence || 'NONE',
            tags: data.tags || [],
            customData: data.customData || {},
            status: 'PENDING',
        });
        revalidatePath('/dashboard/expenses');
        return { success: true, id: String(doc._id) };
    } catch (err) {
        console.error('createExpense error:', err);
        return { success: false, error: 'Failed to create expense' };
    }
}

export async function updateExpenseStatus(
    id: string,
    status: ExpenseStatus,
    approvedBy?: string,
    notes?: string,
) {
    try {
        await connectMongo();
        const Expense = getExpenseModel();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: Record<string, any> = { status };
        if (status === 'APPROVED') {
            updateData.approvedBy = approvedBy || 'Admin';
            updateData.approvedAt = new Date();
        }
        if (status === 'PAID') {
            updateData.paidAt = new Date();
        }
        if (notes) updateData.notes = notes;

        // Update budget spent if approved/paid
        if (status === 'APPROVED' || status === 'PAID') {
            const expense = await Expense.findById(id).lean();
            if (expense) {
                const Budget = getBudgetModel();
                const currentPeriod = getCurrentPeriodLabel('MONTHLY');
                await Budget.updateOne(
                    { category: expense.category, periodLabel: currentPeriod },
                    { $inc: { spent: expense.amount } },
                );
            }
        }

        await Expense.findByIdAndUpdate(id, updateData);
        revalidatePath('/dashboard/expenses');
        return { success: true };
    } catch (err) {
        console.error('updateExpenseStatus error:', err);
        return { success: false, error: 'Failed to update expense status' };
    }
}

export async function updateExpense(
    id: string,
    data: Partial<{
        title: string;
        description: string;
        amount: number;
        currency: string;
        category: ExpenseCategory;
        vendor: string;
        invoiceRef: string;
        paymentMethod: string;
        recurrence: RecurrenceType;
        tags: string[];
        notes: string;
    }>
) {
    try {
        await connectMongo();
        const Expense = getExpenseModel();
        await Expense.findByIdAndUpdate(id, data);
        revalidatePath('/dashboard/expenses');
        return { success: true };
    } catch (err) {
        console.error('updateExpense error:', err);
        return { success: false, error: 'Failed to update expense' };
    }
}

export async function deleteExpense(id: string) {
    try {
        await connectMongo();
        const Expense = getExpenseModel();
        await Expense.findByIdAndDelete(id);
        revalidatePath('/dashboard/expenses');
        return { success: true };
    } catch (err) {
        console.error('deleteExpense error:', err);
        return { success: false, error: 'Failed to delete expense' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUND FLOWS
// ═══════════════════════════════════════════════════════════════════════════════

export async function getFundFlows(
    page = 1,
    limit = 20,
    search = '',
    type = '',
    dateFrom = '',
    dateTo = '',
) {
    await connectMongo();
    const FundFlow = getFundFlowModel();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};
    if (search) {
        filter.$or = [
            { title: { $regex: search, $options: 'i' } },
            { source: { $regex: search, $options: 'i' } },
            { destination: { $regex: search, $options: 'i' } },
            { referenceId: { $regex: search, $options: 'i' } },
        ];
    }
    if (type && type !== 'ALL') filter.type = type;
    if (dateFrom || dateTo) {
        filter.createdAt = {};
        if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
        if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
        FundFlow.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        FundFlow.countDocuments(filter),
    ]);

    return {
        flows: docs.map(d => toPlain<FundFlowDoc>(d)),
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
}

export async function getFundFlowSummary() {
    await connectMongo();
    const FundFlow = getFundFlowModel();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalInflow, totalOutflow, monthInflow, monthOutflow, byType] = await Promise.all([
        FundFlow.aggregate([{ $match: { type: 'INFLOW' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
        FundFlow.aggregate([{ $match: { type: 'OUTFLOW' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
        FundFlow.aggregate([
            { $match: { type: 'INFLOW', createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        FundFlow.aggregate([
            { $match: { type: 'OUTFLOW', createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        FundFlow.aggregate([
            { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
    ]);

    const tIn = totalInflow[0]?.total ?? 0;
    const tOut = totalOutflow[0]?.total ?? 0;

    return {
        totalInflow: tIn,
        totalOutflow: tOut,
        netFlow: tIn - tOut,
        monthInflow: monthInflow[0]?.total ?? 0,
        monthOutflow: monthOutflow[0]?.total ?? 0,
        byType: byType as { _id: string; total: number; count: number }[],
    };
}

export async function createFundFlow(data: {
    type: FundFlowType;
    title: string;
    description?: string;
    amount: number;
    currency?: string;
    source?: string;
    destination?: string;
    referenceId?: string;
    category?: string;
    linkedExpenseId?: string;
    createdBy: string;
}) {
    try {
        await connectMongo();
        const FundFlow = getFundFlowModel();
        await FundFlow.create({ ...data, currency: data.currency || 'INR' });
        revalidatePath('/dashboard/expenses');
        return { success: true };
    } catch (err) {
        console.error('createFundFlow error:', err);
        return { success: false, error: 'Failed to create fund flow entry' };
    }
}

export async function deleteFundFlow(id: string) {
    try {
        await connectMongo();
        const FundFlow = getFundFlowModel();
        await FundFlow.findByIdAndDelete(id);
        revalidatePath('/dashboard/expenses');
        return { success: true };
    } catch (err) {
        console.error('deleteFundFlow error:', err);
        return { success: false, error: 'Failed to delete fund flow entry' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVESTMENTS
// ═══════════════════════════════════════════════════════════════════════════════

export async function getInvestments(
    page = 1,
    limit = 20,
    search = '',
    status = '',
) {
    await connectMongo();
    const Investment = getInvestmentModel();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};
    if (search) {
        filter.$or = [
            { title: { $regex: search, $options: 'i' } },
            { platform: { $regex: search, $options: 'i' } },
        ];
    }
    if (status && status !== 'ALL') filter.status = status;

    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
        Investment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Investment.countDocuments(filter),
    ]);

    return {
        investments: docs.map(d => toPlain<InvestmentDoc>(d)),
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
}

export async function getInvestmentSummary() {
    await connectMongo();
    const Investment = getInvestmentModel();

    const [totalPrincipal, totalCurrentValue, byStatus, topPerformers] = await Promise.all([
        Investment.aggregate([
            { $match: { status: { $in: ['ACTIVE', 'MATURED'] } } },
            { $group: { _id: null, total: { $sum: '$principal' } } },
        ]),
        Investment.aggregate([
            { $match: { status: { $in: ['ACTIVE', 'MATURED'] } } },
            { $group: { _id: null, total: { $sum: '$currentValue' } } },
        ]),
        Investment.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 }, totalPrincipal: { $sum: '$principal' } } },
        ]),
        Investment.find({ status: 'ACTIVE' })
            .sort({ currentValue: -1 })
            .limit(5)
            .lean(),
    ]);

    const tPrincipal = totalPrincipal[0]?.total ?? 0;
    const tCurrentValue = totalCurrentValue[0]?.total ?? 0;
    const totalReturn = tCurrentValue - tPrincipal;
    const returnPct = tPrincipal > 0 ? ((totalReturn / tPrincipal) * 100).toFixed(2) : '0.00';

    return {
        totalPrincipal: tPrincipal,
        totalCurrentValue: tCurrentValue,
        totalReturn,
        returnPct,
        byStatus: byStatus as { _id: string; count: number; totalPrincipal: number }[],
        topPerformers: topPerformers.map(d => toPlain<InvestmentDoc>(d)),
    };
}

export async function createInvestment(data: {
    title: string;
    description?: string;
    principal: number;
    currentValue?: number;
    currency?: string;
    returnRate?: number;
    platform?: string;
    investedAt: string;
    maturesAt?: string;
    status?: InvestmentStatus;
    category?: string;
    notes?: string;
    createdBy: string;
}) {
    try {
        await connectMongo();
        const Investment = getInvestmentModel();
        await Investment.create({
            ...data,
            currentValue: data.currentValue ?? data.principal,
            currency: data.currency || 'INR',
            status: data.status || 'ACTIVE',
            investedAt: new Date(data.investedAt),
            maturesAt: data.maturesAt ? new Date(data.maturesAt) : undefined,
        });
        revalidatePath('/dashboard/expenses');
        return { success: true };
    } catch (err) {
        console.error('createInvestment error:', err);
        return { success: false, error: 'Failed to create investment' };
    }
}

export async function updateInvestment(
    id: string,
    data: Partial<{
        title: string;
        currentValue: number;
        returnRate: number;
        status: InvestmentStatus;
        notes: string;
        maturesAt: string;
    }>
) {
    try {
        await connectMongo();
        const Investment = getInvestmentModel();
        const updateData = { ...data } as Record<string, unknown>;
        if (data.maturesAt) updateData.maturesAt = new Date(data.maturesAt);
        await Investment.findByIdAndUpdate(id, updateData);
        revalidatePath('/dashboard/expenses');
        return { success: true };
    } catch (err) {
        console.error('updateInvestment error:', err);
        return { success: false, error: 'Failed to update investment' };
    }
}

export async function deleteInvestment(id: string) {
    try {
        await connectMongo();
        const Investment = getInvestmentModel();
        await Investment.findByIdAndDelete(id);
        revalidatePath('/dashboard/expenses');
        return { success: true };
    } catch (err) {
        console.error('deleteInvestment error:', err);
        return { success: false, error: 'Failed to delete investment' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUDGETS
// ═══════════════════════════════════════════════════════════════════════════════

function getCurrentPeriodLabel(period: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'): string {
    const now = new Date();
    if (period === 'MONTHLY') {
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    if (period === 'QUARTERLY') {
        const q = Math.ceil((now.getMonth() + 1) / 3);
        return `${now.getFullYear()}-Q${q}`;
    }
    return `${now.getFullYear()}`;
}

export async function getBudgets() {
    await connectMongo();
    const Budget = getBudgetModel();
    const docs = await Budget.find({}).sort({ category: 1 }).lean();
    return docs.map(d => toPlain<BudgetDoc>(d));
}

export async function upsertBudget(data: {
    category: ExpenseCategory;
    limit: number;
    currency?: string;
    period: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    alertThreshold?: number;
    alerts?: boolean;
}) {
    try {
        await connectMongo();
        const Budget = getBudgetModel();
        const periodLabel = getCurrentPeriodLabel(data.period);

        await Budget.findOneAndUpdate(
            { category: data.category, periodLabel },
            {
                $set: {
                    limit: data.limit,
                    currency: data.currency || 'INR',
                    period: data.period,
                    alerts: data.alerts ?? true,
                    alertThreshold: data.alertThreshold ?? 80,
                },
                $setOnInsert: { spent: 0 },
            },
            { upsert: true, returnDocument: 'after' }
        );

        revalidatePath('/dashboard/expenses');
        return { success: true };
    } catch (err) {
        console.error('upsertBudget error:', err);
        return { success: false, error: 'Failed to save budget' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPI / GATEWAY LEDGERS (CORPORATE TRACKING)
// ═══════════════════════════════════════════════════════════════════════════════

export async function getUpiAccounts() {
    await connectMongo();
    const Model = getUpiAccountModel();
    const docs = await Model.find({}).sort({ name: 1 }).lean();
    return docs.map((d: any) => toPlain<UpiAccountDoc>(d));
}

export async function upsertUpiAccount(data: {
    _id?: string;
    name: string;
    upiId: string;
    type: 'MANUAL' | 'GATEWAY';
    providerName?: string;
    status: 'ACTIVE' | 'MAINTENANCE' | 'DISABLED';
    limitAmount?: number;
    feePercent?: number;
}) {
    try {
        await connectMongo();
        const Model = getUpiAccountModel();
        if (data._id) {
            await Model.findByIdAndUpdate(data._id, {
                $set: { 
                    name: data.name, 
                    upiId: data.upiId, 
                    type: data.type, 
                    providerName: data.providerName,
                    status: data.status,
                    limitAmount: data.limitAmount,
                    feePercent: data.feePercent
                }
            });
        } else {
            await Model.create({
                name: data.name,
                upiId: data.upiId,
                type: data.type,
                providerName: data.providerName,
                status: data.status,
                limitAmount: data.limitAmount || 0,
                feePercent: data.feePercent || 0,
                totalDeposits: 0,
                totalWithdrawals: 0,
                currentBalance: 0
            });
        }
        revalidatePath('/dashboard/expenses');
        return { success: true };
    } catch (err) {
        console.error('upsertUpiAccount:', err);
        return { success: false, error: 'Failed to save UPI account' };
    }
}

export async function deleteUpiAccount(id: string) {
    try {
        await connectMongo();
        const Model = getUpiAccountModel();
        await Model.findByIdAndDelete(id);
        revalidatePath('/dashboard/expenses');
        return { success: true };
    } catch (err) {
        return { success: false, error: 'Failed to delete' };
    }
}

/**
 * Auto-discover gateways from historical platform deposits
 */
export async function syncHistoricalGateways() {
    try {
        const { prisma } = await import('@/lib/db');
        await connectMongo();
        
        // Load Payment Methods from Prisma to replace Hex ObjectIds
        const pmRecords = await prisma.paymentMethod.findMany({ select: { id: true, name: true } });
        const pmMap = new Map<string, string>();
        for (const pm of pmRecords) {
            pmMap.set(String(pm.id), pm.name);
        }

        // 1. Fetch completed/approved transactions
        const transactions = await prisma.transaction.findMany({
            where: {
                type: { in: ['DEPOSIT', 'WITHDRAWAL'] },
                status: { in: ['COMPLETED', 'APPROVED'] }
            },
            select: { 
                id: true,
                type: true, 
                amount: true, 
                paymentMethod: true, 
                paymentDetails: true,
                createdAt: true,
                user: { select: { username: true } }
            }
        });

        // 2. Aggregate operations by gateway name
        const gatewayData = new Map<string, { in: number, out: number, txns: any[] }>();

        for (const tx of transactions) {
            let gw = (tx.paymentMethod || '').trim();
            const pd = (tx.paymentDetails as Record<string, any>) || {};

            if (!gw) {
                if (pd && typeof pd === 'object') {
                    gw = String(pd.senderUpiId || pd.gateway || pd.method || '').trim();
                }
            }

            if (!gw) gw = tx.type === 'WITHDRAWAL' ? 'Legacy Payouts' : 'External/Unknown';
            if (gw.toLowerCase() === 'manual_upi') gw = 'Manual UPI';
            if (gw.toLowerCase() === 'admin_manual') gw = 'Admin Manual Deposit';

            // Resolve Hex ObjectIds back to readable names
            if (gw.length === 24) {
                if (pmMap.has(gw)) {
                    gw = pmMap.get(gw)!;
                } else if (gw.toLowerCase() === '69cc06c5ee8f2605fe9005fe') {
                    gw = 'Platform Gateway (Primary)';
                } else {
                    gw = `External Node (${gw.substring(0, 6).toUpperCase()})`;
                }
            }

            const current = gatewayData.get(gw) || { in: 0, out: 0, txns: [] };
            if (tx.type === 'DEPOSIT') current.in += tx.amount;
            if (tx.type === 'WITHDRAWAL') current.out += tx.amount;
            
            // Enrich the tx object for detailed granular tracing
            const hName = pd.holderName || pd.acctName || pd.receive_name;
            const extId = pd.upiId || pd.receive_account || pd.receiveAccount || pd.accountNo || pd.acctNo || pd.senderUpiId || pd.utr;
            
            current.txns.push({
                ...tx,
                extractedHolder: hName,
                extractedExtId: extId
            });

            gatewayData.set(gw, current);
        }

        const NodeModel = getUpiAccountModel();
        const FundModel = getFundFlowModel();
        let createdCount = 0;

        for (const [name, vols] of gatewayData.entries()) {
            if (vols.in <= 0 && vols.out <= 0) continue;
            
            const existing = await NodeModel.findOne({ name: new RegExp('^' + name + '$', 'i') });
            if (existing) continue;

            const upiIdStr = `auto_${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

            const newNode = await NodeModel.create({
                name: name,
                upiId: upiIdStr.substring(0, 20) + '_' + Math.floor(Math.random() * 999), 
                type: name.toLowerCase().includes('manual') ? 'MANUAL' : 'GATEWAY',
                providerName: 'Auto-Discovered',
                status: 'ACTIVE',
                totalDeposits: vols.in,
                totalWithdrawals: vols.out,
                currentBalance: vols.in - vols.out,
                limitAmount: 0,
                feePercent: 0,
            });

            // Map standard DB rows into granular corporate FundFlow documents for the trace engine!
            const flowDocs = vols.txns.map(t => {
                const uName = t.user?.username || `User_${t.userId || t.id}`;
                if (t.type === 'DEPOSIT') {
                    return {
                        type: 'INFLOW',
                        title: `Auto-Sync Deposit ID:${t.id}`,
                        amount: t.amount,
                        source: t.extractedHolder ? `${t.extractedHolder} (${t.extractedExtId || 'External'})` : (t.extractedExtId ? `${uName} (${t.extractedExtId})` : uName),
                        destination: newNode.name,
                        category: 'USER_DEPOSIT',
                        createdBy: 'SYSTEM/AUTO_DISCOVERY',
                        createdAt: t.createdAt
                    };
                } else {
                    return {
                        type: 'OUTFLOW',
                        title: `Auto-Sync Withdrawal ID:${t.id}`,
                        amount: t.amount,
                        source: newNode.name,
                        destination: t.extractedHolder ? `${t.extractedHolder} (${t.extractedExtId || 'External'})` : (t.extractedExtId ? `${uName} (${t.extractedExtId})` : uName),
                        category: 'USER_WITHDRAWAL',
                        createdBy: 'SYSTEM/AUTO_DISCOVERY',
                        createdAt: t.createdAt
                    };
                }
            });

            if (flowDocs.length > 0) {
                // Bulk insert safely
                await FundModel.insertMany(flowDocs, { ordered: false });
            }

            createdCount++;
        }
        revalidatePath('/dashboard/expenses');
        return { success: true, count: createdCount, uniqueFound: gatewayData.size };
    } catch (e) {
        console.error('syncHistorical error:', e);
        return { success: false, error: 'Database query failed' };
    }
}

/**
 * To be called strictly when money leaves/enters our ecosystem automatically or manually
 */
export async function recordUpiLedgerEffect(
    upiId: string, 
    amount: number, 
    type: 'DEPOSIT' | 'WITHDRAWAL', 
    referenceLabel: string, 
    adminId: string,
    meta?: { holderName?: string, externalId?: string }
) {
    try {
        if (!upiId || amount <= 0) return { success: false, error: 'Invalid operation' };
        await connectMongo();
        const Model = getUpiAccountModel();
        const account = await Model.findOne({ upiId });
        if (!account) return { success: false, error: 'Ledger account not found' };

        const FundModel = getFundFlowModel();

        if (type === 'DEPOSIT') {
            await Model.findByIdAndUpdate(account._id, {
                $inc: {
                    totalDeposits: amount,
                    currentBalance: amount
                }
            });
            // Automatically log to corporate fund flows
            await FundModel.create({
                type: 'INFLOW',
                title: `Platform Deposit ${referenceLabel}`,
                amount: amount,
                source: meta?.holderName ? `${meta.holderName} (${meta.externalId || 'User'})` : 'Platform End Users',
                destination: account.name,
                category: 'USER_DEPOSIT',
                createdBy: 'SYSTEM/ADMIN'
            });
        } else if (type === 'WITHDRAWAL') {
            await Model.findByIdAndUpdate(account._id, {
                $inc: {
                    totalWithdrawals: amount,
                    currentBalance: -amount
                }
            });
            await FundModel.create({
                type: 'OUTFLOW',
                title: `Platform Withdrawal ${referenceLabel}`,
                amount: amount,
                source: account.name,
                destination: meta?.holderName ? `${meta.holderName} (${meta.externalId || 'User'})` : 'Platform End Users',
                category: 'USER_WITHDRAWAL',
                createdBy: 'SYSTEM/ADMIN'
            });
        }
        revalidatePath('/dashboard/expenses');
        return { success: true };
    } catch (err) {
        console.error('recordUpiLedgerEffect crash:', err);
        return { success: false, error: 'Runtime failure applying ledger effects' };
    }
}

/**
 * Advanced query to pull the exactly logged events crossing a specified node.
 */
export async function getGatewayHistory(gatewayName: string) {
    try {
        if (!gatewayName) return [];
        await connectMongo();
        const FundModel = getFundFlowModel();
        const history = await FundModel.find({
            $or: [
                { source: gatewayName },
                { destination: gatewayName }
            ]
        }).sort({ createdAt: -1 }).limit(100).lean();
        return history.map((d: any) => toPlain(d));
    } catch (err) {
        console.error('getGatewayHistory error:', err);
        return [];
    }
}

export async function deleteBudget(id: string) {
    try {
        await connectMongo();
        const Budget = getBudgetModel();
        await Budget.findByIdAndDelete(id);
        revalidatePath('/dashboard/expenses');
        return { success: true };
    } catch (err) {
        console.error('deleteBudget error:', err);
        return { success: false, error: 'Failed to delete budget' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS — combined dashboard summary
// ═══════════════════════════════════════════════════════════════════════════════

export async function getExpenseDashboardSummary() {
    await connectMongo();
    const Expense = getExpenseModel();
    const FundFlow = getFundFlowModel();
    const Investment = getInvestmentModel();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // last 6 months data for chart
    const last6Months: { label: string; inflow: number; outflow: number; expenses: number }[] = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });

        const [inf, out, exp] = await Promise.all([
            FundFlow.aggregate([
                { $match: { type: 'INFLOW', createdAt: { $gte: d, $lt: nextD } } },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
            FundFlow.aggregate([
                { $match: { type: 'OUTFLOW', createdAt: { $gte: d, $lt: nextD } } },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
            Expense.aggregate([
                { $match: { status: { $in: ['APPROVED', 'PAID'] }, createdAt: { $gte: d, $lt: nextD } } },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
        ]);

        last6Months.push({
            label,
            inflow: inf[0]?.total ?? 0,
            outflow: out[0]?.total ?? 0,
            expenses: exp[0]?.total ?? 0,
        });
    }

    const [
        pendingExpenses,
        approvedThisMonth,
        activeInvestments,
        totalInvestmentValue,
        netFundFlow,
    ] = await Promise.all([
        Expense.countDocuments({ status: 'PENDING' }),
        Expense.aggregate([
            { $match: { status: { $in: ['APPROVED', 'PAID'] }, createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        Investment.countDocuments({ status: 'ACTIVE' }),
        Investment.aggregate([
            { $match: { status: { $in: ['ACTIVE', 'MATURED'] } } },
            { $group: { _id: null, total: { $sum: '$currentValue' } } },
        ]),
        FundFlow.aggregate([
            {
                $group: {
                    _id: null,
                    inflow: { $sum: { $cond: [{ $eq: ['$type', 'INFLOW'] }, '$amount', 0] } },
                    outflow: { $sum: { $cond: [{ $eq: ['$type', 'OUTFLOW'] }, '$amount', 0] } },
                },
            },
        ]),
    ]);

    const flowData = netFundFlow[0] ?? { inflow: 0, outflow: 0 };

    return {
        pendingExpenses,
        approvedThisMonth: approvedThisMonth[0]?.total ?? 0,
        activeInvestments,
        totalInvestmentValue: totalInvestmentValue[0]?.total ?? 0,
        netFundFlow: flowData.inflow - flowData.outflow,
        last6Months,
    };
}
