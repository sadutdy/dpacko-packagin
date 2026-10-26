import { AppError } from '../../core/errors/AppError.js';
import { deliveryRepository } from '../delivery/delivery.repository.js';
import { inventoryService } from '../inventory/inventory.service.js';
import { ordersRepository } from '../orders/orders.repository.js';
import { paymentsRepository } from '../payments/payments.repository.js';
import { productionRepository } from '../production/production.repository.js';

function resolveRange(query: { from?: Date; to?: Date }) {
  const to = query.to ?? new Date();
  const from = query.from ?? new Date(to.getTime() - 30 * 86_400_000);
  if (from > to) throw AppError.validation('The "from" date must be before "to"');
  return { from, to };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export const reportsService = {
  async dashboard() {
    const today = startOfToday();
    const todayMatch = { createdAt: { $gte: today } };

    const [ordersToday, revenueByMonth, orderStatuses, jobStages, deliveryStatuses, lowStock, wip] = await Promise.all([
      ordersRepository.listOrders(todayMatch, 0, 1000),
      ordersRepository.revenueByMonth(),
      ordersRepository.statusCounts(),
      productionRepository.stageCounts(),
      deliveryRepository.statusCounts(),
      inventoryService.lowStock(),
      productionRepository.listJobs(
        { stage: { $nin: ['ready', 'scrapped', 'cancelled'] } },
        0,
        500,
      ),
    ]);
    const revenueToday = ordersToday.reduce((sum, order) => sum + order.pricing.grandTotalPaise, 0);
    const lastThreeMonths = revenueByMonth.slice(-3);
    return {
      today: { ordersPlaced: ordersToday.length, revenueTodayPaise: revenueToday },
      revenueByMonth: lastThreeMonths.map((row) => ({
        year: row._id.year,
        month: row._id.month,
        revenuePaise: row.revenue,
        orders: row.count,
      })),
      orderStatuses: orderStatuses.map((row) => ({ status: row._id, count: row.count })),
      jobStages: jobStages.map((row) => ({ stage: row.stage, count: row.count })),
      deliveryStatuses,
      workInProgress: wip.length,
      lowStockCount: lowStock.length,
      lowStock: lowStock.slice(0, 10),
    };
  },

  async productionReport(query: { from?: Date; to?: Date }) {
    const { from, to } = resolveRange(query);
    const [statusCounts, wastage] = await Promise.all([
      productionRepository.stageCounts(),
      inventoryService.wastageReport(),
    ]);
    const scrapped = await productionRepository.listJobs({ stage: { $in: ['scrapped'] }, createdAt: { $gte: from, $lte: to } }, 0, 500);
    const completed = await productionRepository.listJobs({ stage: 'ready' }, 0, 500);
    return {
      range: { from, to },
      stages: statusCounts.map((row) => ({ stage: row.stage, count: row.count })),
      quantityScrapped: scrapped.reduce((sum, job) => sum + job.quantityScrapped, 0),
      quantityCompleted: completed.reduce((sum, job) => sum + job.quantityCompleted, 0),
      wastageByMaterial: wastage.map((row) => ({ materialId: row.materialId, totalQty: row.totalQty, entries: row.count })),
    };
  },

  async salesReport(query: { from?: Date; to?: Date }) {
    const { from, to } = resolveRange(query);
    const match = { status: { $nin: ['draft', 'cancelled'] }, createdAt: { $gte: from, $lte: to } };
    const [revenueByMonth, topCustomers, topSkus] = await Promise.all([
      ordersRepository.revenueByMonth(match),
      ordersRepository.topCustomers(match, 5),
      ordersRepository.topSkus(match, 10),
    ]);
    return {
      range: { from, to },
      revenueByMonth: revenueByMonth.map((row) => ({
        year: row._id.year,
        month: row._id.month,
        revenuePaise: row.revenue,
        orders: row.count,
      })),
      totalRevenuePaise: revenueByMonth.reduce((sum, row) => sum + row.revenue, 0),
      topCustomers: topCustomers.map((row) => ({ customerId: String(row._id), totalValuePaise: row.totalValue, orderCount: row.orderCount })),
      topSkus: topSkus.map((row) => ({ skuCode: row._id, name: row.name, totalQty: row.totalQty, totalRevenuePaise: row.totalRevenue })),
    };
  },

  async receivablesReport() {
    const [aging, collections] = await Promise.all([
      paymentsRepository.invoiceAging(),
      paymentsRepository.paymentCollectionsByMonth(),
    ]);
    return {
      aging: aging.map((row) => ({ status: row._id, count: row.count, totalPaise: row.totalPaise })),
      collectionsByMonth: collections.map((row) => ({
        year: row._id.year,
        month: row._id.month,
        totalPaise: row.totalPaise,
        count: row.count,
      })),
    };
  },
};
