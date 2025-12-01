import React, { useState, useEffect, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import {
  ColDef,
  GridReadyEvent,
  ValueFormatterParams,
  CellClickedEvent,
  GridApi,
  ColumnApi,
  IServerSideGetRowsParams,
  IServerSideDatasource,
  CellValueChangedEvent,
} from 'ag-grid-community';
import { Button, Modal, Form, Input, Select, DatePicker, Space, Alert } from 'antd';
import type { RangePickerProps } from 'antd/es/date-picker';
import moment, { Moment } from 'moment';
import {
  getFinancialData,
  updateFinancialData,
  createFinancialData,
  deleteFinancialData,
  getListOfMonths,
} from '../../api/financialApi';
import { FinancialData } from '../../types/financialTypes';
import EditableCellRenderer from './EditableCellRenderer';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { setLoading } from '../../features/uiSlice';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import {
  setFinancialData as setReduxFinancialData,
  clearFinancialData as clearReduxFinancialData,
} from '../../features/financialSlice';
import { error, success } from '../../utils/notification';
import { useAuth } from '../../context/AuthContext';

const { RangePicker } = DatePicker;

const FinancialSummary: React.FC = () => {
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [gridColumnApi, setGridColumnApi] = useState<ColumnApi | null>(null);
  const [rowData, setRowData] = useState<FinancialData[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingData, setEditingData] = useState<FinancialData | null>(null);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [months, setMonths] = useState<string[]>([]);
  const [selectedDateRange, setSelectedDateRange] = useState<
    [Moment | null, Moment | null] | null
  >(null);
  const [trendMonths, setTrendMonths] = useState<string[]>([]);
  const [isTrendModalVisible, setIsTrendModalVisible] = useState(false);
  const [selectedTrendMonths, setSelectedTrendMonths] = useState<string[]>([]);
  const [trendData, setTrendData] = useState<FinancialData[]>([]);
  const [isMonthlyTrendLoading, setIsMonthlyTrendLoading] = useState(false);
  const dispatch = useAppDispatch();
  const financialDataFromRedux = useAppSelector((state) => state.financial.financialData);
  const { token } = useAuth();

  const currencyFormatter = (params: ValueFormatterParams) => {
    if (params.value === null || params.value === undefined) {
      return '';
    }
    return '$' + Number(params.value).toFixed(2);
  };

  const columnDefs: ColDef[] = [
    {
      headerName: 'ID',
      field: 'id',
      sortable: true,
      filter: true,
      width: 70,
    },
    {
      headerName: 'Month',
      field: 'month',
      sortable: true,
      filter: true,
      width: 120,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: months,
      },
    },
    {
      headerName: 'Revenue',
      field: 'revenue',
      sortable: true,
      filter: true,
      valueFormatter: currencyFormatter,
      editable: true,
    },
    {
      headerName: 'Expenses',
      field: 'expenses',
      sortable: true,
      filter: true,
      valueFormatter: currencyFormatter,
      editable: true,
    },
    {
      headerName: 'Profit',
      field: 'profit',
      sortable: true,
      filter: true,
      valueFormatter: currencyFormatter,
      editable: false,
      valueGetter: (params) => {
        const revenue = params.data?.revenue || 0;
        const expenses = params.data?.expenses || 0;
        return revenue - expenses;
      },
    },
  ];

  const defaultColDef = {
    flex: 1,
    minWidth: 100,
    editable: false,
    resizable: true,
  };

  useEffect(() => {
    fetchMonths();
  }, []);

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const fetchFinancialData = async () => {
    dispatch(setLoading(true));
    try {
      const data = await getFinancialData(token);
      setRowData(data);
      dispatch(setReduxFinancialData(data));
    } catch (e: any) {
      error(e.message);
    } finally {
      dispatch(setLoading(false));
    }
  };

  const fetchMonths = async () => {
    try {
      const monthsList = await getListOfMonths(token);
      setMonths(monthsList);
    } catch (e: any) {
      error(e.message);
    }
  };

  const onGridReady = (params: GridReadyEvent) => {
    setGridApi(params.api);
    setGridColumnApi(params.columnApi);
  };

  const showModal = () => {
    setIsModalVisible(true);
    form.resetFields();
    setEditingData(null);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    setEditingData(null);
  };

  const handleCreate = () => {
    form
      .validateFields()
      .then((values) => {
        const newFinancialData = {
          ...values,
          revenue: parseFloat(values.revenue),
          expenses: parseFloat(values.expenses),
        };

        dispatch(setLoading(true));
        createFinancialData(newFinancialData, token)
          .then((response) => {
            setRowData([...rowData, response]);
            dispatch(setReduxFinancialData([...rowData, response]));
            setIsModalVisible(false);
            form.resetFields();
            success('Financial data created successfully!');
          })
          .catch((e: any) => {
            error(e.message);
          })
          .finally(() => {
            dispatch(setLoading(false));
          });
      })
      .catch((info) => {
        console.log('Validate Failed:', info);
      });
  };

  const onCellClicked = useCallback((event: CellClickedEvent) => {
    console.log('cellClicked', event);
  }, []);

  const handleEdit = (data: FinancialData) => {
    setEditingData(data);
    form.setFieldsValue({
      month: data.month,
      revenue: data.revenue.toString(),
      expenses: data.expenses.toString(),
    });
    setIsModalVisible(true);
  };

  const handleUpdate = () => {
    form
      .validateFields()
      .then((values) => {
        if (!editingData) return;

        const updatedData = {
          ...editingData,
          month: values.month,
          revenue: parseFloat(values.revenue),
          expenses: parseFloat(values.expenses),
        };

        dispatch(setLoading(true));
        updateFinancialData(updatedData, token)
          .then(() => {
            const updatedRowData = rowData.map((item) =>
              item.id === updatedData.id ? updatedData : item
            );
            setRowData(updatedRowData);
            dispatch(setReduxFinancialData(updatedRowData));
            setIsModalVisible(false);
            setEditingData(null);
            success('Financial data updated successfully!');
          })
          .catch((e: any) => {
            error(e.message);
          })
          .finally(() => {
            dispatch(setLoading(false));
          });
      })
      .catch((info) => {
        console.log('Validate Failed:', info);
      });
  };

  const showDeleteModal = (id: number) => {
    setDeletingId(id);
    setIsDeleteModalVisible(true);
  };

  const hideDeleteModal = () => {
    setDeletingId(null);
    setIsDeleteModalVisible(false);
  };

  const handleDelete = () => {
    if (!deletingId) return;

    dispatch(setLoading(true));
    deleteFinancialData(deletingId, token)
      .then(() => {
        const updatedRowData = rowData.filter((item) => item.id !== deletingId);
        setRowData(updatedRowData);
        dispatch(setReduxFinancialData(updatedRowData));
        setIsDeleteModalVisible(false);
        setDeletingId(null);
        success('Financial data deleted successfully!');
      })
      .catch((e: any) => {
        error(e.message);
      })
      .finally(() => {
        dispatch(setLoading(false));
      });
  };

  const handleDateRangeChange: RangePickerProps['onChange'] = (dates, dateStrings) => {
    setSelectedDateRange(dates as [Moment | null, Moment | null]);
    console.log('From: ', dateStrings[0], ', to: ', dateStrings[1]);
  };

  const handleFilter = () => {
    if (selectedDateRange && selectedDateRange[0] && selectedDateRange[1]) {
      const startDate = selectedDateRange[0].format('YYYY-MM-DD');
      const endDate = selectedDateRange[1].format('YYYY-MM-DD');

      const filteredData = financialDataFromRedux.filter((item) => {
        const itemDate = moment(item.month, 'YYYY-MM');
        return itemDate.isBetween(startDate, endDate, null, '[]');
      });

      setRowData(filteredData);
    } else {
      setRowData(financialDataFromRedux);
    }
  };

  const handleClearFilter = () => {
    setSelectedDateRange(null);
    setRowData(financialDataFromRedux);
  };

  const showTrendModal = async () => {
    setIsTrendModalVisible(true);
    try {
      const monthsList = await getListOfMonths(token);
      setTrendMonths(monthsList);
    } catch (e: any) {
      error(e.message);
    }
  };

  const handleTrendCancel = () => {
    setIsTrendModalVisible(false);
    setSelectedTrendMonths([]);
    setTrendData([]);
  };

  const handleTrendMonthsChange = (values: string[]) => {
    setSelectedTrendMonths(values);
  };

  const handleShowMonthlyTrend = async () => {
    if (!selectedTrendMonths || selectedTrendMonths.length === 0) {
      error('Please select at least one month to show the trend.');
      return;
    }

    setIsMonthlyTrendLoading(true);
    try {
      // Fetch data for selected months
      const trendData = financialDataFromRedux.filter((item) =>
        selectedTrendMonths.includes(item.month)
      );
      setTrendData(trendData);
    } catch (e: any) {
      error(e.message);
    } finally {
      setIsMonthlyTrendLoading(false);
    }
  };

  const handleCellSave = async (event: CellValueChangedEvent) => {
    const { data } = event;

    if (!data) {
      console.error('No data found in the cell change event');
      return;
    }

    dispatch(setLoading(true));
    try {
      await updateFinancialData(data, token);

      const updatedRowData = rowData.map((item) => (item.id === data.id ? data : item));
      setRowData(updatedRowData);
      dispatch(setReduxFinancialData(updatedRowData));

      success('Financial data updated successfully!');
    } catch (e: any) {
      error(e.message);
      // Revert the changes in the grid
      gridApi?.setRowData(rowData);
    } finally {
      dispatch(setLoading(false));
    }
  };

  return (
    <div className="financial-summary">
      <div className="toolbar">
        <Space>
          <Button type="primary" onClick={showModal}>
            Add Financial Data
          </Button>
          <RangePicker onChange={handleDateRangeChange} value={selectedDateRange} />
          <Button onClick={handleFilter}>Filter</Button>
          <Button onClick={handleClearFilter}>Clear Filter</Button>
          <Button type="primary" onClick={showTrendModal}>
            Show Monthly Trend
          </Button>
        </Space>
      </div>

      <div className="ag-theme-alpine" style={{ height: 500, width: '100%' }}>
        <AgGridReact
          columnDefs={columnDefs}
          rowData={rowData}
          defaultColDef={defaultColDef}
          onGridReady={onGridReady}
          rowSelection="multiple"
          onCellClicked={onCellClicked}
          onCellValueChanged={handleCellSave}
          editType="fullRow"
        />
      </div>

      <Modal
        title={editingData ? 'Edit Financial Data' : 'Add Financial Data'}
        visible={isModalVisible}
        onCancel={handleCancel}
        footer={[
          <Button key="cancel" onClick={handleCancel}>
            Cancel
          </Button>,
          <Button key="ok" type="primary" onClick={editingData ? handleUpdate : handleCreate}>
            {editingData ? 'Update' : 'Create'}
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="month"
            label="Month"
            rules={[{ required: true, message: 'Please select the month!' }]}
          >
            <Select options={months.map((month) => ({ label: month, value: month }))} />
          </Form.Item>
          <Form.Item
            name="revenue"
            label={
              <>
                Revenue&nbsp;
                <Tooltip title="Enter the revenue for the selected month.">
                  <QuestionCircleOutlined />
                </Tooltip>
              </>
            }
            rules={[
              { required: true, message: 'Please input the revenue!' },
              {
                pattern: /^\d+(\.\d{1,2})?$/,
                message: 'Revenue must be a number with up to 2 decimal places.',
              },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="expenses"
            label={
              <>
                Expenses&nbsp;
                <Tooltip title="Enter the expenses for the selected month.">
                  <QuestionCircleOutlined />
                </Tooltip>
              </>
            }
            rules={[
              { required: true, message: 'Please input the expenses!' },
              {
                pattern: /^\d+(\.\d{1,2})?$/,
                message: 'Expenses must be a number with up to 2 decimal places.',
              },
            ]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Confirm Delete"
        visible={isDeleteModalVisible}
        onOk={handleDelete}
        onCancel={hideDeleteModal}
      >
        <p>Are you sure you want to delete this financial data?</p>
      </Modal>

      <Modal
        title="Monthly Trend"
        visible={isTrendModalVisible}
        onCancel={handleTrendCancel}
        footer={[
          <Button key="cancel" onClick={handleTrendCancel}>
            Cancel
          </Button>,
          <Button key="show" type="primary" onClick={handleShowMonthlyTrend} loading={isMonthlyTrendLoading}>
            Show Trend
          </Button>,
        ]}
      >
        <Form.Item label="Select Months">
          <Select
            mode="multiple"
            placeholder="Select months to show trend"
            onChange={handleTrendMonthsChange}
            style={{ width: '100%' }}
            options={trendMonths.map((month) => ({ label: month, value: month }))}
          />
        </Form.Item>

        {trendData.length > 0 && (
          <div>
            <h3>Trend Data:</h3>
            <ul>
              {trendData.map((item) => (
                <li key={item.id}>
                  {item.month}: Revenue - ${item.revenue}, Expenses - ${item.expenses}, Profit - $
                  {item.revenue - item.expenses}
                </li>
              ))}
            </ul>
          </div>
        )}
        {isMonthlyTrendLoading && <Alert message="Loading trend data..." type="info" showIcon />}
      </Modal>
    </div>
  );
};

export default FinancialSummary;
