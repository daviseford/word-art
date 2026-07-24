from pathlib import Path

import yaml


WORKSPACE_ROOT = Path(__file__).resolve().parents[2]


def load_workflow(name):
    path = WORKSPACE_ROOT / ".github" / "workflows" / name
    return yaml.load(path.read_text(encoding="utf-8"), Loader=yaml.BaseLoader)


def test_api_workflow_limits_oidc_to_the_deployment_job():
    workflow = load_workflow("deploy-api.yml")

    assert workflow["permissions"] == {"contents": "read"}
    assert "permissions" not in workflow["jobs"]["verify"]
    assert workflow["jobs"]["package-and-deploy"]["permissions"] == {
        "contents": "read",
        "id-token": "write",
    }

    verify_commands = {
        step["run"]
        for step in workflow["jobs"]["verify"]["steps"]
        if "run" in step
    }
    deploy_commands = {
        step["run"]
        for step in workflow["jobs"]["package-and-deploy"]["steps"]
        if "run" in step
    }

    assert "python -m pytest" in verify_commands
    assert "npm ci" in verify_commands
    assert "npm ci --ignore-scripts" in deploy_commands
    assert "npm run package" in deploy_commands


def test_api_role_limits_lambda_access_to_the_named_function_and_qualifiers():
    template = (
        WORKSPACE_ROOT / "infra" / "github-actions-deploy-roles.yml"
    ).read_text(encoding="utf-8")

    exact_function = (
        'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:'
        'function:${ApiFunctionName}"'
    )
    qualified_function = (
        'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:'
        'function:${ApiFunctionName}:*"'
    )

    assert exact_function in template
    assert qualified_function in template
    assert 'function:${ApiFunctionName}*"' not in template
