/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// 内存存储，用于localstorage模式下临时保存在线用户状态
const onlineUsersMemoryStore: Map<string, any> = new Map();

export async function POST(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

  try {
    const body = await request.json();
    const authInfo = getAuthInfoFromCookie(request);

    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = authInfo.username;
    const { videoTitle, source, id, episodeIndex, currentTime, duration } =
      body as {
        videoTitle: string;
        source: string;
        id: string;
        episodeIndex: number;
        currentTime: number;
        duration: number;
      };

    if (!videoTitle || !source || !id) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 获取用户IP和用户代理
    const ip = request.ip || request.headers.get('x-forwarded-for') || '';
    const userAgent = request.headers.get('user-agent') || '';

    const statusData = {
      username,
      videoTitle,
      source,
      id,
      episodeIndex,
      currentTime,
      duration,
      lastUpdate: Date.now(),
      ip,
      userAgent,
    };

    if (storageType === 'localstorage') {
      // 使用内存存储
      onlineUsersMemoryStore.set(username, statusData);
      console.log('POST - 保存到内存存储:', username, statusData);
    } else {
      // 使用数据库存储
      console.log('POST - 开始保存到数据库, username:', username);
      console.log('POST - statusData:', JSON.stringify(statusData));
      await db.setOnlineUserStatus(username, statusData);
      console.log('POST - 保存到数据库成功');

      // 验证保存是否成功
      const savedData = await db.getAllOnlineUserStatus();
      console.log('POST - 验证保存后的数据:', JSON.stringify(savedData));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('更新在线用户状态失败:', error);
    return NextResponse.json(
      {
        error: '更新在线用户状态失败',
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

  try {
    console.log('GET - 开始获取在线用户状态');
    console.log('GET - storageType:', storageType);

    const authInfo = getAuthInfoFromCookie(request);
    console.log('GET - authInfo:', authInfo);

    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 检查用户是否为管理员或站长
    let isOwner = false;
    let isAdmin = false;

    if (storageType !== 'localstorage') {
      const adminConfig = await db.getAdminConfig();
      const username = authInfo.username;
      const envUsername = process.env.USERNAME;
      isOwner = username === envUsername;
      isAdmin =
        adminConfig?.UserConfig.Users.some(
          (u) => u.username === username && u.role === 'admin',
        ) || false;
      console.log('GET - adminConfig:', JSON.stringify(adminConfig));
      console.log('GET - username:', username);
      console.log('GET - envUsername:', envUsername);
      console.log('GET - isOwner:', isOwner, 'isAdmin:', isAdmin);
    } else {
      // 对于localstorage模式，简化权限检查，只要是登录用户就可以查看（仅用于测试）
      isOwner = true;
      isAdmin = true;
    }

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: '权限不足' }, { status: 401 });
    }

    let onlineUsers: { [key: string]: any } = {};

    if (storageType === 'localstorage') {
      // 从内存存储获取
      console.log(
        'GET - 使用内存存储，当前数据条数:',
        onlineUsersMemoryStore.size,
      );
      onlineUsersMemoryStore.forEach((value, key) => {
        onlineUsers[key] = value;
      });
    } else {
      // 从数据库存储获取
      console.log('GET - 开始从数据库获取在线用户状态');
      onlineUsers = await db.getAllOnlineUserStatus();
      console.log('GET - 从数据库获取到的在线用户状态:', onlineUsers);
    }

    console.log('GET - 原始在线用户数据:', JSON.stringify(onlineUsers));

    // 过滤掉过期的状态（超过30分钟）
    const now = Date.now();
    console.log('GET - 当前时间:', now);
    const validOnlineUsers = Object.entries(onlineUsers).reduce(
      (acc, [key, status]) => {
        console.log(
          'GET - 检查用户:',
          key,
          'lastUpdate:',
          status.lastUpdate,
          '差距:',
          now - status.lastUpdate,
        );
        if (status.lastUpdate && now - status.lastUpdate < 30 * 60 * 1000) {
          acc[key] = status;
        }
        return acc;
      },
      {} as { [key: string]: any },
    );

    console.log('GET - 有效在线用户数据:', JSON.stringify(validOnlineUsers));
    return NextResponse.json(validOnlineUsers);
  } catch (error) {
    console.error('获取在线用户状态失败:', error);
    return NextResponse.json(
      {
        error: '获取在线用户状态失败',
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

  try {
    const authInfo = getAuthInfoFromCookie(request);

    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = authInfo.username;

    if (storageType === 'localstorage') {
      // 从内存存储移除
      onlineUsersMemoryStore.delete(username);
    } else {
      // 从数据库存储移除
      await db.removeOnlineUserStatus(username);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('移除在线用户状态失败:', error);
    return NextResponse.json(
      {
        error: '移除在线用户状态失败',
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
