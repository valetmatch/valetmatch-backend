#!/bin/bash
echo "=== Testing Admin API ==="
echo ""
echo "1. Testing pending valeters endpoint:"
curl -s https://valetmatch-backend.onrender.com/api/admin/pending-valeters \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImRlcHV0eW1pdGNoZWxsQG1lLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc2MzM5Mzg0MiwiZXhwIjoxNzYzNDgwMjQyfQ.enNYaia5oxCv6wTb-k3CYWqbOeim4RcpAaGymWYmYX0"
echo ""
echo ""
echo "2. Testing stats endpoint:"
curl -s https://valetmatch-backend.onrender.com/api/admin/stats \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImRlcHV0eW1pdGNoZWxsQG1lLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc2MzM5Mzg0MiwiZXhwIjoxNzYzNDgwMjQyfQ.enNYaia5oxCv6wTb-k3CYWqbOeim4RcpAaGymWYmYX0"
echo ""
