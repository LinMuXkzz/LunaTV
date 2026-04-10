/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行在线用户状态管理',
      },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const authInfo = getAuthInfoFromCookie(request);
    
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const username = authInfo.username;
    const {
      videoTitle,
      source,
      id,
      episodeIndex,
      currentTime,
      duration,
    } = body as {
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

    // 更新在线用户状态
    await db.setOnlineUserStatus(username, {
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
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('更新在线用户状态失败:', error);
    return NextResponse.json(
      {
        error: '更新在线用户状态失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行在线用户状态管理',
      },
      { status: 400 }
    );
  }

  try {
    const authInfo = getAuthInfoFromCookie(request);
    
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 检查用户是否为管理员或站长
    const adminConfig = await db.getAdminConfig();
    const username = authInfo.username;
    const isOwner = username === process.env.USERNAME;
    const isAdmin = adminConfig?.UserConfig.Users.some(
      (u) => u.username === username && u.role === 'admin'
    );

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: '权限不足' }, { status: 401 });
    }

    // 获取所有在线用户状态
    const onlineUsers = await db.getAllOnlineUserStatus();
    
    // 过滤掉过期的状态（超过30分钟）
    const now = Date.now();
    const validOnlineUsers = Object.entries(onlineUsers).reduce((acc, [key, status]) => {
      if (status.lastUpdate && (now - status.lastUpdate) < 30 * 60 * 1000) {
        acc[key] = status;
      }
      return acc;
    }, {} as { [key: string]: any });

    return NextResponse.json(validOnlineUsers);
  } catch (error) {
    console.error('获取在线用户状态失败:', error);
    return NextResponse.json(
      {
        error: '获取在线用户状态失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行在线用户状态管理',
      },
      { status: 400 }
    );
  }

  try {
    const authInfo = getAuthInfoFromCookie(request);
    
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = authInfo.username;
    
    // 移除当前用户的在线状态
    await db.removeOnlineUserStatus(username);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('移除在线用户状态失败:', error);
    return NextResponse.json(
      {
        error: '移除在线用户状态失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
