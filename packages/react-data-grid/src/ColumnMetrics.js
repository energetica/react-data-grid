const shallowCloneObject = require('./shallowCloneObject');
const sameColumn = require('./ColumnComparer');
const ColumnUtils = require('./ColumnUtils');
const getScrollbarSize  = require('./getScrollbarSize');
const isColumnsImmutable  = require('./utils/isColumnsImmutable');

type Column = {
  key: string;
  left: number;
  width: number;
};

type ColumnMetricsType = {
    columns: Array<Column>;
    totalWidth: number;
    minColumnWidth: number;
};

function setColumnWidths(columns, totalWidth) {
  return columns.map(column => {
    let colInfo = Object.assign({}, column);
    if (column.width) {
      if (/^([0-9]+)%$/.exec(column.width.toString())) {
        colInfo.width = Math.floor(
          column.width / 100 * totalWidth);
      }
    }
    return colInfo;
  });
}

function setDefferedColumnWidths(columns, unallocatedWidth, minColumnWidth) {
  let defferedColumns = columns.filter(c => !c.width);
  let defferedColumnsRemaining = ColumnUtils.getSize(defferedColumns);
  let remainingUnallocatedWidth = unallocatedWidth;

  return columns.map((column) => {
    if (!column.width && column.width !== 0) {
      if (unallocatedWidth <= 0) {
        column.width = minColumnWidth;
      } else {
        let unallocatedWidthFraction = Math.floor(unallocatedWidth / (ColumnUtils.getSize(defferedColumns)));
        let columnWidth = Math.max(unallocatedWidthFraction, minColumnWidth);

        remainingUnallocatedWidth -= columnWidth;
        defferedColumnsRemaining -= 1;

        if (defferedColumnsRemaining === 0 && remainingUnallocatedWidth > 0) {
          columnWidth += remainingUnallocatedWidth;
        }

        column.width = columnWidth;
      }
    }
    return column;
  });
}

function setColumnOffsets(columns) {
  let left = 0;
  return columns.map(column => {
    column.left = left;
    left += column.width;
    return column;
  });
}

/**
 * Update column metrics calculation.
 *
 * @param {ColumnMetricsType} metrics
 * @param showScrollbar
 */
function recalculate(metrics: ColumnMetricsType, showScrollbar: boolean): ColumnMetricsType {
    // compute width for columns which specify width
  let columns = setColumnWidths(metrics.columns, metrics.totalWidth);

  let unallocatedWidth = columns.filter(c => c.width).reduce((w, column) => {
    return w - column.width;
  }, metrics.totalWidth);

  unallocatedWidth -= getScrollbarSize(showScrollbar);

  let width = columns.filter(c => c.width).reduce((w, column) => {
    return w + column.width;
  }, 0);

  // compute width for columns which doesn't specify width
  columns = setDefferedColumnWidths(columns, unallocatedWidth, metrics.minColumnWidth);

  // compute left offset
  columns = setColumnOffsets(columns);

  return {
    columns,
    width,
    totalWidth: metrics.totalWidth,
    minColumnWidth: metrics.minColumnWidth
  };
}

/**
 * Update column metrics calculation by resizing a column.
 *
 * @param {ColumnMetricsType} metrics
 * @param index
 * @param {number} width
 * @param showScrollbar
 */
function resizeColumn(metrics: ColumnMetricsType, index: number, width: number, showScrollbar: boolean): ColumnMetricsType {
  let column = ColumnUtils.getColumn(metrics.columns, index);
  let metricsClone = shallowCloneObject(metrics);
  metricsClone.columns = metrics.columns.slice(0);

  let updatedColumn = shallowCloneObject(column);
  updatedColumn.width = Math.max(width, metricsClone.minColumnWidth);

  metricsClone = ColumnUtils.spliceColumn(metricsClone, index, updatedColumn);

  return recalculate(metricsClone, showScrollbar);
}

function areColumnsImmutable(prevColumns: Array<Column>, nextColumns: Array<Column>) {
  return isColumnsImmutable(prevColumns) && isColumnsImmutable(nextColumns);
}

function compareEachColumn(prevColumns: Array<Column>, nextColumns: Array<Column>, isSameColumn: (a: Column, b: Column) => boolean) {
  let i;
  let len;
  let column;
  let prevColumnsByKey: { [key:string]: Column } = {};
  let nextColumnsByKey: { [key:string]: Column } = {};


  if (ColumnUtils.getSize(prevColumns) !== ColumnUtils.getSize(nextColumns)) {
    return false;
  }

  for (i = 0, len = ColumnUtils.getSize(prevColumns); i < len; i++) {
    column = prevColumns[i];
    prevColumnsByKey[column.key] = column;
  }

  for (i = 0, len = ColumnUtils.getSize(nextColumns); i < len; i++) {
    column = nextColumns[i];
    nextColumnsByKey[column.key] = column;
    let prevColumn = prevColumnsByKey[column.key];
    if (prevColumn === undefined || !isSameColumn(prevColumn, column)) {
      return false;
    }
  }

  for (i = 0, len = ColumnUtils.getSize(prevColumns); i < len; i++) {
    column = prevColumns[i];
    let nextColumn = nextColumnsByKey[column.key];
    if (nextColumn === undefined) {
      return false;
    }
  }
  return true;
}

function sameColumns(prevColumns: Array<Column>, nextColumns: Array<Column>, isSameColumn: (a: Column, b: Column) => boolean): boolean {
  if (areColumnsImmutable(prevColumns, nextColumns)) {
    return prevColumns === nextColumns;
  }

  return compareEachColumn(prevColumns, nextColumns, isSameColumn);
}

module.exports = { recalculate, resizeColumn, sameColumn, sameColumns };
