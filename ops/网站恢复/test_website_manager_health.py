import subprocess
import unittest
import importlib.util
from pathlib import Path
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('website_manager', Path(__file__).with_name('website-manager.py'))
manager = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(manager)


class TunnelHealthTests(unittest.TestCase):
    def test_counts_edges_and_connectors(self):
        output = ('CONNECTOR ID CREATED ARCHITECTURE VERSION ORIGIN IP EDGE\n'
                  'ceb925ce-ae50-433e-aad8-4b483fcb8a97 now windows 2026 127.0.0.1 1xsin15, 1xsin19\n')
        self.assertEqual(manager.parse_tunnel_info(output), ('HEALTHY', 2, 1, ''))

    def test_zero_connections_is_down(self):
        output = 'CONNECTOR ID CREATED ARCHITECTURE VERSION ORIGIN IP EDGE\n'
        self.assertEqual(manager.parse_tunnel_info(output), ('DOWN', 0, 0, ''))

    def test_failed_and_timed_out_queries_are_unknown(self):
        self.assertEqual(manager.parse_tunnel_info('unauthorized', 1)[0], 'UNKNOWN')
        with patch.object(manager.subprocess, 'run', side_effect=subprocess.TimeoutExpired('cloudflared', 8)):
            self.assertEqual(manager.tunnel_info()[0], 'UNKNOWN')


if __name__ == '__main__':
    unittest.main()
