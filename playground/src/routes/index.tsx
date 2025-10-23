import { createFileRoute } from '@tanstack/react-router';
import { Card, Typography, Space, Row, Col, Statistic } from 'antd';
import {
  RocketOutlined,
  ThunderboltOutlined,
  CodeOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

function IndexPage() {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Space direction="vertical" size="middle">
          <Title level={2}>
            <RocketOutlined /> 欢迎使用 Universal Filter
          </Title>
          <Paragraph style={{ fontSize: 16 }}>
            这是一个强大的、类型安全的筛选器状态管理库,基于 Formily 构建,
            支持 JSON Schema 驱动的表单渲染。
          </Paragraph>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="类型安全"
              value="100%"
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
            <Text type="secondary">完整的 TypeScript 支持</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Schema 驱动"
              value="JSON"
              prefix={<CodeOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
            <Text type="secondary">使用 JSON Schema 定义表单</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="插件系统"
              value="3+"
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
            <Text type="secondary">内置 URL 同步等插件</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="响应式"
              value="Fast"
              prefix={<RocketOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
            <Text type="secondary">基于 Formily 的高性能</Text>
          </Card>
        </Col>
      </Row>

      <Card title="核心特性">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong>✅ JSON Schema 驱动</Text>
            <Paragraph type="secondary">
              使用 Formily JSON Schema 定义表单结构,无需手写 JSX 组件
            </Paragraph>
          </div>
          <div>
            <Text strong>✅ 双态管理</Text>
            <Paragraph type="secondary">
              区分草稿态(draft)和已应用态(applied),支持延迟应用
            </Paragraph>
          </div>
          <div>
            <Text strong>✅ URL 同步</Text>
            <Paragraph type="secondary">
              内置 URL 同步插件,自动将筛选状态同步到 URL 查询参数
            </Paragraph>
          </div>
          <div>
            <Text strong>✅ 类型安全</Text>
            <Paragraph type="secondary">
              完整的 TypeScript 类型推导和类型安全保证
            </Paragraph>
          </div>
          <div>
            <Text strong>✅ 插件扩展</Text>
            <Paragraph type="secondary">
              支持自定义插件,扩展筛选器功能
            </Paragraph>
          </div>
        </Space>
      </Card>

      <Card title="快速开始">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong>1. 查看基础示例</Text>
            <Paragraph type="secondary">
              访问"基础示例"页面,了解如何使用 JSON Schema 创建筛选表单
            </Paragraph>
          </div>
          <div>
            <Text strong>2. 探索高级功能</Text>
            <Paragraph type="secondary">
              访问"高级功能"页面,学习 URL 同步、自动应用等高级特性
            </Paragraph>
          </div>
          <div>
            <Text strong>3. 自定义配置</Text>
            <Paragraph type="secondary">
              访问"配置示例"页面,了解如何自定义筛选器配置
            </Paragraph>
          </div>
        </Space>
      </Card>
    </Space>
  );
}

export const Route = createFileRoute('/')({
  component: IndexPage,
});

