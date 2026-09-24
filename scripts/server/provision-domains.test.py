import importlib.util
import unittest
spec=importlib.util.spec_from_file_location('provision', 'scripts/server/provision-domains.py')
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
class DomainConfig(unittest.TestCase):
 def test_hostname_cannot_inject_nginx(self):
  for host in ['example.com; include /etc/*','../example.com','*.example.com','evil\n.com','-x.example.com','x..example.com']:
   self.assertFalse(p.valid_host(host))
   with self.assertRaises(ValueError):p.config(host)
 def test_http_acme_and_https_proxy(self):
  self.assertIn('acme-challenge',p.config('site.example.com'))
  self.assertNotIn('listen 443',p.config('site.example.com'))
  text=p.config('site.example.com', '/etc/letsencrypt/live/wr-site-test')
  self.assertIn('listen 443 ssl',text)
  self.assertIn('proxy_pass http://127.0.0.1:3000;',text)
if __name__=='__main__':unittest.main()
