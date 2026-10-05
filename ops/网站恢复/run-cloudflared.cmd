@echo off
rem run-cloudflared.cmd
rem ��;������ cloudflared ��������־׷��д���ļ����� run-cloudflared-hidden.vbs �����ش��ڵ��ã�
rem ά���������� / ��־·������������ı��ļ�����
"%ProgramFiles(x86)%\cloudflared\cloudflared.exe" tunnel run main >> "%USERPROFILE%\.cloudflared\cloudflared-run.log" 2>&1
